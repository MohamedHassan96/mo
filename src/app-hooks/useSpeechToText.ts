import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSpeechRecognition } from './useWebSpeechRecognition';
import { useGeminiSTT } from './useGeminiSTT';
import { useConfigStore } from '@/state/configStore';

interface UseSpeechToTextOptions {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Smart Speech-to-Text Hook
 * Prioritizes Gemini API (if key is valid), reliably falls back to Web Speech API
 */
export function useSpeechToText(options: UseSpeechToTextOptions) {
  const { language, onResult, onError } = options;
  const { geminiApiKey, groqApiKey } = useConfigStore(state => state.config);
  const apiSpeechKey = geminiApiKey || groqApiKey || 'server';

  // Default to Chrome/Web Speech API (highly accurate for Egyptian Arabic dialects, real-time, free)
  const [provider, setProvider] = useState<'api' | 'web'>('web');

  const wasListeningRef = useRef(false);

  // Automatically fall back to Server STT if the browser doesn't support Web Speech API
  useEffect(() => {
    const win = window as any;
    const isWebSpeechSupported = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
    if (!isWebSpeechSupported && provider === 'web') {
      console.log('[STT] Web Speech API not supported in this browser, falling back to Server API STT');
      setProvider('api');
    }
  }, [provider]);

  // Fallback handler if API transcription fails (e.g. invalid API key)
  const handleApiSpeechError = useCallback((err: string) => {
    console.error('[STT] API transcription failed, falling back to Web Speech API:', err);
    if (provider === 'api') {
      setProvider('web');
      onError?.(err);
    }
  }, [provider, onError]);

  const handleApiSpeechResult = useCallback((text: string, isFinal: boolean) => {
    if (text) {
      onResult(text, isFinal);
    }
  }, [onResult]);

  // Initialize hooks
  const webSpeech = useWebSpeechRecognition(options);
  const geminiSTT = useGeminiSTT({ 
    ...options, 
    onResult: handleApiSpeechResult,
    onError: handleApiSpeechError
  });

  const activeProvider = provider === 'api' && apiSpeechKey ? geminiSTT : webSpeech;

  // Track if we should be listening so we can hot-swap if provider changes
  useEffect(() => {
    if (activeProvider.isListening) {
      wasListeningRef.current = true;
    } else if (!activeProvider.isListening && provider === 'web') {
      // If we switched to web but it's not listening, and we were listening before, restart it
      if (wasListeningRef.current) {
        console.log('[STT] Auto-restarting Web Speech API after fallback...');
        activeProvider.startListening();
      }
    }
  }, [activeProvider.isListening, provider, activeProvider]);

  return {
    isListening: activeProvider.isListening,
    isSupported: activeProvider.isSupported,
    startListening: (stream?: MediaStream | null) => {
      wasListeningRef.current = true;
      activeProvider.startListening(stream);
    },
    stopListening: () => {
      wasListeningRef.current = false;
      activeProvider.stopListening();
    }
  };
}
