/**
 * الترجمة الفورية - Real-time Translation
 * يستخدم نماذج سريعة للترجمة اللحظية
 */

import { useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { useConfigStore } from '@/state/configStore';
import { useRoomStore } from '@/state/roomStore';
import { getLanguageName } from '@/config/languages';
import type { TranscriptEntry, ParticipantRole } from '@/types';

interface TranslationOptions {
  speakerId: string;
  speakerName: string;
  speakerRole: ParticipantRole;
  sourceLanguage: string;
  targetLanguage: string;
}

export function useRealtimeTranslation() {
  const config = useConfigStore((s) => s.config);
  const { addTranscript, setProcessingStatus, audioPlaybackEnabled } = useRoomStore();
  const processingRef = useRef(false);

  // ترجمة فورية باستخدام Groq (سريع جداً)
  const translateText = useCallback(async (
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> => {
    if (!text.trim() || sourceLang === targetLang) return text;

    const srcName = getLanguageName(sourceLang);
    const tgtName = getLanguageName(targetLang);

    const systemPrompt = `أنت مترجم فوري محترف وذكي.
مهمتك: ترجمة النص مباشرة من ${srcName} إلى ${tgtName}.
القواعد الأساسية:
1. قم بإرجاع الترجمة فقط، بدون أي مقدمات، بدون تفسيرات، بدون أي نصوص إضافية.
2. الترجمة يجب أن تكون طبيعية وتراعي السياق.
3. إذا كانت اللغة المصدر أو الهدف هي العربية المصرية، فاستخدم اللهجة المصرية بشكل سليم (مثال: "إزيك" بدلاً من "كيف حالك").
4. حافظ على سرعة المعنى ودقته لأن هذا التطبيق يستخدم للترجمة الفورية أثناء المكالمات.
5. لا تضف علامات ترقيم إذا كان النص الأصلي غير مكتمل.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer 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`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // أسرع نموذج
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });

      if (!response.ok) throw new Error('Translation failed');
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || text;
    } catch (err) {
      console.error('Translation error:', err);
      return text;
    }
  }, [config.groqApiKey]);

  // قائمة انتظار TTS لمنع التداخل
  const ttsQueueRef = useRef<(() => Promise<void>)[]>([]);
  const ttsPlayingRef = useRef(false);

  const drainTTSQueue = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) return;
    ttsPlayingRef.current = true;
    try {
      await next();
    } finally {
      ttsPlayingRef.current = false;
      drainTTSQueue();
    }
  }, []);

  // تحويل النص إلى صوت وتشغيله
  const speakText = useCallback((text: string, language: string): Promise<void> => {
    if (!text.trim() || !audioPlaybackEnabled) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const task = async () => {
        // إعادة استخدام عنصر الصوت المثبت في الصفحة (لحل مشكلة iOS autoplay)
        const player = (document.getElementById('tts-audio-player') as HTMLAudioElement | null)
          ?? new Audio();

        try {
          const voiceId = language === 'ar'
            ? 'cjVigY5qzO86Huf0OWal'
            : 'EXAVITQu4vr4xnSDxMaL';

          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': 'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.8 },
              }),
            }
          );

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            player.src = url;
            await new Promise<void>((res) => {
              player.onended = () => { URL.revokeObjectURL(url); res(); };
              player.onerror = () => { URL.revokeObjectURL(url); res(); };
              player.play().catch(() => res());
            });
            resolve();
            return;
          }
        } catch (err) {
          console.error('ElevenLabs TTS error:', err);
        }

        // Fallback: Web Speech Synthesis
        if ('speechSynthesis' in window) {
          await new Promise<void>((res) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = language === 'ar' ? 'ar-EG' : language;
            utterance.rate = 1.0;
            utterance.onend = () => res();
            utterance.onerror = () => res();
            window.speechSynthesis.speak(utterance);
          });
        }
        resolve();
      };

      ttsQueueRef.current.push(task);
      drainTTSQueue();
    });
  }, [audioPlaybackEnabled, drainTTSQueue]);

  // debounce timer لترجمة النصوص المؤقتة تلقائياً
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterimTextRef = useRef('');
  const lastOptionsRef = useRef<TranslationOptions | null>(null);
  const lastCallbackRef = useRef<((entry: TranscriptEntry) => void) | undefined>(undefined);
  // منع تكرار الترجمة: نتتبع النص الأخير الذي تمت ترجمته
  const lastTranslatedTextRef = useRef<string>('');

  // الدالة الفعلية للإرسال (الترجمة والصوت تتم في السيرفر الآن)
  const translateAndSend = useCallback(async (
    text: string,
    options: TranslationOptions,
    onTranslationComplete?: (entry: TranscriptEntry) => void
  ) => {
    if (!text.trim()) return;
    if (lastTranslatedTextRef.current === text.trim()) return;
    if (processingRef.current) return;
    processingRef.current = true;
    lastTranslatedTextRef.current = text.trim();

    const { speakerId, speakerName, speakerRole, sourceLanguage } = options;

    try {
      const entry: TranscriptEntry = {
        id: uuid(),
        speakerId,
        speakerName,
        speakerRole,
        originalText: text,
        originalLanguage: sourceLanguage,
        translatedText: text,
        translatedLanguage: sourceLanguage,
        timestamp: Date.now(),
      };

      addTranscript(entry);

      if (onTranslationComplete) {
        onTranslationComplete(entry);
      }

      setProcessingStatus({ stage: 'listening', message: 'جاري الاستماع...' });

    } catch (err) {
      console.error('Processing error:', err);
      setProcessingStatus({ stage: 'error', message: 'خطأ' });
    } finally {
      processingRef.current = false;
      // بعد ثانيتين، أعد تعيين النص المترجم للسماح بترجمة جملة مشابهة لاحقاً
      setTimeout(() => { lastTranslatedTextRef.current = ''; }, 2000);
    }
  }, [translateText, addTranscript, setProcessingStatus]);

  // معالجة النص المُعرَف عليه مع دعم الترجمة الفورية
  const processRecognizedText = useCallback((
    text: string,
    isFinal: boolean,
    options: TranslationOptions,
    onTranslationComplete?: (entry: TranscriptEntry) => void
  ) => {
    if (!text.trim()) return;

    if (isFinal) {
      // نص نهائي: ألغِ الـ debounce وترجم فوراً
      if (interimTimerRef.current) {
        clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }
      lastInterimTextRef.current = '';
      translateAndSend(text, options, onTranslationComplete);
    } else {
      // نص مؤقت: أظهره واضبط debounce بـ 1.2 ثانية
      setProcessingStatus({ stage: 'transcribing', message: text.substring(0, 35) + '...' });

      // حفظ آخر قيم للاستخدام في الـ debounce
      lastInterimTextRef.current = text;
      lastOptionsRef.current = options;
      lastCallbackRef.current = onTranslationComplete;

      // إعادة ضبط التايمر في كل تحديث
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
      interimTimerRef.current = setTimeout(() => {
        const pendingText = lastInterimTextRef.current;
        const pendingOpts = lastOptionsRef.current;
        const pendingCb = lastCallbackRef.current;
        if (pendingText && pendingOpts) {
          lastInterimTextRef.current = '';
          translateAndSend(pendingText, pendingOpts, pendingCb);
        }
      }, 1200); // ترجم بعد 1.2 ثانية من التوقف عن الكلام
    }
  }, [translateAndSend, setProcessingStatus]);

  return { processRecognizedText, speakText };
}
