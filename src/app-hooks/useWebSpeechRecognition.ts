/**
 * Groq Whisper API - التعرف الفوري على الصوت (بديل للنظام الآلي للمتصفح)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

declare const process: any;
// قراءة مفتاح Groq سواء من Vite البيئة أو كـ Fallback
const GROQ_KEY = (typeof process !== 'undefined' && process.env && process.env.GROQ_API_KEY) || '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';

interface UseWebSpeechOptions {
  language: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useWebSpeechRecognition(options: UseWebSpeechOptions) {
  const { language, onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isListeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  const sendAudioToGroq = async (audioBlob: Blob, lang: string) => {
    if (audioBlob.size < 1000) return; // تجاهل المقاطع الفارغة جداً

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-large-v3-turbo'); 
    formData.append('response_format', 'json');
    
    const langCode = lang === 'ar' ? 'ar' : lang === 'en' ? 'en' : lang.split('-')[0];
    formData.append('language', langCode);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim()) {
          console.log('🎤 Groq Whisper:', data.text);
          // Groq Whisper يرجع النص النهائي دائماً
          onResultRef.current(data.text.trim(), true);
        }
      } else {
        const text = await res.text();
        console.error('[STT Groq] API error:', text);
      }
    } catch (e) {
      console.error('[STT Groq] network error:', e);
    }
  };

  const startRecordingLoop = useCallback(() => {
    if (!isListeningRef.current || !streamRef.current) return;
    
    // إيقاف التسجيل القديم إن وجد
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          sendAudioToGroq(e.data, languageRef.current);
        }
      };
      
      recorder.start();

      // كل 3 ثوانٍ نقطع التسجيل ونرسله، ونبدأ تسجيلاً جديداً بـ Header جديد
      timerRef.current = setTimeout(() => {
        if (isListeningRef.current) {
          if (recorder.state !== 'inactive') recorder.stop();
          startRecordingLoop();
        }
      }, 3000);
      
    } catch (err) {
      console.error('MediaRecorder error:', err);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      isListeningRef.current = true;
      setIsListening(true);
      console.log('🎤 Started Groq API STT listening:', language);
      
      startRecordingLoop();
      
    } catch (e) {
      console.error('[STT] Mic error:', e);
      onError?.('حدث خطأ في الوصول للميكروفون');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [language, onError, startRecordingLoop]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // لا نغلق الـ stream هنا إذا أردنا إعادة التشغيل بسرعة، لكن للأمان نغلقه
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    console.log('🎤 Stopped Groq API STT');
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isListening, isSupported, startListening, stopListening };
}
