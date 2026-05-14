/**
 * Web Speech API - التعرف الفوري على الصوت
 * يعمل في المتصفح مباشرة بدون إرسال ملفات للخادم
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// أنواع Web Speech API
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);

  // تحقق من دعم المتصفح
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // إنشاء وتهيئة التعرف على الصوت
  const initRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    
    // إعدادات للتعرف الفوري
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;
    
    // تعيين اللغة - دعم اللهجة المصرية
    if (language === 'ar') {
      recognition.lang = 'ar-EG'; // العربية المصرية
    } else if (language === 'en') {
      recognition.lang = 'en-US';
    } else {
      recognition.lang = language;
    }

    // معالجة النتائج الفورية
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        console.log('🎤 Final:', finalTranscript);
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        console.log('🎤 Interim:', interimTranscript);
        onResult(interimTranscript.trim(), false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError?.(event.error);
      }
    };

    recognition.onend = () => {
      // إعادة التشغيل تلقائياً
      if (isListeningRef.current && continuous) {
        setTimeout(() => {
          try {
            if (isListeningRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.log('Restart error, retrying...');
          }
        }, 100);
      }
    };

    return recognition;
  }, [language, continuous, interimResults, onResult, onError]);

  // بدء الاستماع
  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.('المتصفح لا يدعم التعرف على الصوت');
      return;
    }

    // إيقاف أي جلسة سابقة
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      try {
        recognition.start();
        setIsListening(true);
        console.log('🎤 Started listening:', language);
      } catch (e) {
        console.error('Start error:', e);
        isListeningRef.current = false;
      }
    }
  }, [isSupported, initRecognition, language, onError]);

  // إيقاف الاستماع
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    console.log('🎤 Stopped');
  }, []);

  // تنظيف
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
