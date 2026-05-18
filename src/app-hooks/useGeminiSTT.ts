import { useCallback, useRef, useState, useEffect } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { useVoiceActivityRecorder } from './useVoiceActivityRecorder';
import { transcribeAudio } from '@/services/stt';

interface UseGeminiSTTOptions {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useGeminiSTT(options: UseGeminiSTTOptions) {
  const { language, onResult, onError } = options;
  const { localStream } = useRoomStore();
  const { geminiApiKey, groqApiKey } = useConfigStore(state => state.config);
  const apiSpeechKey = geminiApiKey || groqApiKey || 'server';
  
  const [isListening, setIsListening] = useState(false);
  
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const handleSpeechEnd = useCallback(async (audioBase64: string) => {
    if (!audioBase64) return;

    try {
      // Convert base64 to Blob
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/webm' });

      const result = await transcribeAudio(blob, apiSpeechKey, language);
      if (result.text) {
        onResultRef.current(result.text, true);
      } else {
        console.warn('[API STT] No text returned');
        onError?.('No speech text returned');
      }
    } catch (err) {
      console.error('[API STT] Transcription failed:', err);
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }, [apiSpeechKey, language, onError]);

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

  const startListening = useCallback((stream?: MediaStream | null) => {
    setIsListening(true);
    startVAD(stream);
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
