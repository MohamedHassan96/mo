import { useCallback, useRef, useState, useEffect } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { useVoiceActivityRecorder } from './useVoiceActivityRecorder';
import { transcribeAudioGemini } from '@/services/gemini';

interface UseGeminiSTTOptions {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useGeminiSTT(options: UseGeminiSTTOptions) {
  const { language, onResult, onError } = options;
  const { localStream } = useRoomStore();
  const { geminiApiKey } = useConfigStore(state => state.config);
  
  const [isListening, setIsListening] = useState(false);
  
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const handleSpeechEnd = useCallback(async (audioBase64: string) => {
    if (!audioBase64 || !geminiApiKey) return;

    try {
      // Convert base64 to Blob
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/webm' });

      const text = await transcribeAudioGemini(blob, geminiApiKey, language);
      if (text) {
        onResultRef.current(text, true);
      } else {
        console.warn('[Gemini STT] No text returned');
        // We don't necessarily want to trigger fallback on a single silence, 
        // but if the API itself failed, transcribeAudioGemini would throw.
      }
    } catch (err) {
      console.error('[Gemini STT] Transcription failed:', err);
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [geminiApiKey, language, onError]);

  const {
    startListening: startVAD,
    stopListening: stopVAD,
    isListening: isVADListening
  } = useVoiceActivityRecorder({
    stream: localStream,
    onSpeechEnd: handleSpeechEnd,
    silenceDelay: 1000,
    minDecibels: -60, // Increased sensitivity
  });

  const startListening = useCallback(() => {
    setIsListening(true);
    startVAD();
  }, [startVAD]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    stopVAD();
  }, [stopVAD]);

  return {
    isListening: isListening || isVADListening,
    isSupported: true,
    startListening,
    stopListening
  };
}
