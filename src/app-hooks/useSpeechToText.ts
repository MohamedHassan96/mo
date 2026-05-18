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
  const { geminiApiKey } = useConfigStore(state => state.config);

  // Default to Chrome/Web Speech API (highly accurate for Egyptian Arabic dialects, real-time, free)
  const [provider, setProvider] = useState<'gemini' | 'web'>('web');

  const wasListeningRef = useRef(false);

  // Automatically fall back to Gemini STT if the browser doesn't support Web Speech API
  useEffect(() => {
    const win = window as any;
    const isWebSpeechSupported = !!(win.SpeechRecognition || win.webkitSpeechRecognition);
    if (!isWebSpeechSupported && provider === 'web') {
      console.log('[STT] Web Speech API not supported in this browser, falling back to Gemini STT');
      setProvider('gemini');
    }
  }, [provider]);

  // Fallback handler if Gemini fails (e.g. invalid API key)
  const handleGeminiError = useCallback((err: string) => {
    console.error('[STT] Gemini failed, falling back to Web Speech API:', err);
    if (provider === 'gemini') {
      setProvider('web');
      onError?.(err);
    }
  }, [provider, onError]);

  // Fallback handler if Gemini fails to produce results
  const handleGeminiResult = useCallback((text: string, isFinal: boolean) => {
    if (text) {
      onResult(text, isFinal);
    }
  }, [onResult]);

  // Initialize hooks
  const webSpeech = useWebSpeechRecognition(options);
  const geminiSTT = useGeminiSTT({ 
    ...options, 
    onResult: handleGeminiResult,
    onError: handleGeminiError
  });

  const activeProvider = provider === 'gemini' && geminiApiKey ? geminiSTT : webSpeech;

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
    startListening: () => {
      wasListeningRef.current = true;
      activeProvider.startListening();
    },
    stopListening: () => {
      wasListeningRef.current = false;
      activeProvider.stopListening();
    }
  };
}
