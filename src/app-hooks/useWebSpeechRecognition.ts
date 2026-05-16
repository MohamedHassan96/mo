/**
 * Web Speech API - التعرف الفوري على الصوت
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultItem { transcript: string; confidence: number; }
interface SpeechRecognitionResult { isFinal: boolean; length: number; [index: number]: SpeechRecognitionResultItem; }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; message: string; }
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean; interimResults: boolean; maxAlternatives: number; lang: string;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface UseWebSpeechOptions {
  language: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useWebSpeechRecognition(options: UseWebSpeechOptions) {
  const { language, continuous = true, interimResults = true, onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef  = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef  = useRef(false);

  // BUG-FIX-4: keep a ref to the latest onResult so recognition always uses fresh callback
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    const win = window as any;
    setIsSupported(!!(win.SpeechRecognition || win.webkitSpeechRecognition));
  }, []);

  const initRecognition = useCallback(() => {
    const win = window as any;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return null;

    const r: SpeechRecognitionInstance = new SR();
    r.continuous      = continuous;
    r.interimResults  = interimResults;
    r.maxAlternatives = 1;

    if (language === 'ar')      r.lang = 'ar-EG';
    else if (language === 'en') r.lang = 'en-US';
    else                        r.lang = language;

    r.onstart = () => {
      console.log('🎤 Speech Recognition started');
      setIsListening(true);
    };

    r.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '', interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText   += t;
        else                          interimText  += t;
      }
      // BUG-FIX-4: always call the LATEST onResult via ref
      if (finalText)       { console.log('🎤 Final:', finalText);   onResultRef.current(finalText.trim(),   true);  }
      else if (interimText){ console.log('🎤 Interim:', interimText); onResultRef.current(interimText.trim(), false); }
    };

    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      // BUG-FIX-3: only ONE restart path — handled in onend, not here.
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      console.warn('[STT] Error:', event.error);
      onError?.(event.error);
    };

    r.onend = () => {
      console.log('🎤 Speech Recognition ended');
      setIsListening(false);
      // BUG-FIX-3: single restart path — only if we should still be listening
      if (isListeningRef.current && continuous) {
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (_) { /* already running */ }
          }
        }, 200);
      }
    };

    return r;
  }, [language, continuous, interimResults, onError]);

  const startListening = useCallback(() => {
    if (!isSupported) { onError?.('المتصفح لا يدعم التعرف على الصوت'); return; }

    // stop any previous session cleanly
    if (recognitionRef.current) {
      isListeningRef.current = false; // prevent onend restart for OLD recognition
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    isListeningRef.current = true;

    // small delay to let old recognition fully stop before starting new one
    setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
          setIsListening(true);
          console.log('🎤 Started listening:', language);
        } catch (e) {
          console.error('[STT] Start error:', e);
          isListeningRef.current = false;
          setIsListening(false);
        }
      }
    }, 100);
  }, [isSupported, initRecognition, language, onError]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    console.log('🎤 Stopped');
  }, []);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  // BUG-FIX-10: restart recognition when language changes mid-session
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current === language) return;
    prevLanguageRef.current = language;
    if (isListeningRef.current) {
      // Stop current session; onend will restart with new language via startListening
      isListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
      recognitionRef.current = null;
      // Re-start with the new language after a small delay
      setTimeout(() => {
        isListeningRef.current = true;
        const r = initRecognition();
        if (!r) return;
        recognitionRef.current = r;
        try { r.start(); setIsListening(true); } catch (_) {}
      }, 200);
    }
  }, [language, initRecognition]);

  return { isListening, isSupported, startListening, stopListening };
}
