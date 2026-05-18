/**
 * الترجمة الفورية - Real-time Translation
 * يستخدم نماذج سريعة للترجمة اللحظية
 */

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { translateText as translateService } from '@/services/translate';
import { synthesizeSpeech, playAudioBlob } from '@/services/tts';
import type { TranscriptEntry, ParticipantRole } from '@/types';

interface TranslationOptions {
  speakerId: string;
  speakerName: string;
  speakerRole: ParticipantRole;
  sourceLanguage: string;
  targetLanguage: string;
}

export function useRealtimeTranslation() {
  const { addTranscript, updateTranscript, setProcessingStatus, audioPlaybackEnabled } = useRoomStore();
  const config = useConfigStore((state) => state.config);
  const { groqApiKey, geminiApiKey, elevenLabsApiKey, elevenLabsVoiceId, ttsProvider } = config;

  // قائمة انتظار TTS لمنع التداخل
  const ttsQueueRef = useRef<(() => Promise<void>)[]>([]);
  const ttsPlayingRef = useRef(false);
  const audioPlaybackEnabledRef = useRef(audioPlaybackEnabled);

  useEffect(() => {
    audioPlaybackEnabledRef.current = audioPlaybackEnabled;
  }, [audioPlaybackEnabled]);

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
        if (!audioPlaybackEnabledRef.current) {
          resolve();
          return;
        }

        try {
          const blob = await synthesizeSpeech({
            text,
            language,
            provider: ttsProvider,
            elevenLabsApiKey: elevenLabsApiKey,
            elevenLabsVoiceId: elevenLabsVoiceId,
          });

          if (blob) {
            await playAudioBlob(blob);
          }
        } catch (err) {
          console.error('TTS error:', err);
        }
        resolve();
      };

      ttsQueueRef.current.push(task);
      drainTTSQueue();
    });
  }, [audioPlaybackEnabled, drainTTSQueue, elevenLabsApiKey, elevenLabsVoiceId, ttsProvider]);

  // debounce timer لترجمة النصوص المؤقتة تلقائياً
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterimTextRef = useRef('');
  const lastOptionsRef = useRef<TranslationOptions | null>(null);
  const lastCallbackRef = useRef<((entry: TranscriptEntry) => void) | undefined>(undefined);
  // منع تكرار الترجمة: نتتبع النص الأخير الذي تمت ترجمته
  const lastTranslatedTextRef = useRef<string>('');

  const cancelPendingTranslation = useCallback(() => {
    if (interimTimerRef.current) {
      clearTimeout(interimTimerRef.current);
      interimTimerRef.current = null;
    }
    lastInterimTextRef.current = '';
    lastOptionsRef.current = null;
    lastCallbackRef.current = undefined;
    lastTranslatedTextRef.current = '';
  }, []);

  // الدالة الفعلية للإرسال (الترجمة والصوت تتم في السيرفر الآن)
  const translateAndSend = useCallback(async (
    text: string,
    options: TranslationOptions,
    onTranslationComplete?: (entry: TranscriptEntry) => void
  ) => {
    if (!text.trim()) return;
    if (lastTranslatedTextRef.current === text.trim()) return;
    lastTranslatedTextRef.current = text.trim();

    const { speakerId, speakerName, speakerRole, sourceLanguage, targetLanguage } = options;

    try {
      const entryId = uuid();
      const entry: TranscriptEntry = {
        id: entryId,
        speakerId, speakerName, speakerRole,
        originalText: text,
        originalLanguage: sourceLanguage,
        translatedText: text, // Default to original
        translatedLanguage: sourceLanguage, // Initially same as source to signal "not yet translated"
        targetLanguage,
        timestamp: Date.now(),
      };

      // Add to local UI immediately
      addTranscript(entry);

      setProcessingStatus({ stage: 'translating', message: 'جاري الترجمة...' });

      // Perform translation if API key is available and languages differ
      const activeApiKey = geminiApiKey || groqApiKey;
      if (activeApiKey && sourceLanguage !== targetLanguage) {
        try {
          console.log(`[Translation] Using client-side key for ${sourceLanguage} -> ${targetLanguage}`);
          const result = await translateService(text, sourceLanguage, targetLanguage, geminiApiKey, groqApiKey);

          if (result && result.translatedText && result.translatedText !== text) {
            entry.translatedText = result.translatedText;
            entry.translatedLanguage = targetLanguage; // Now it's actually translated
            // Update local UI with translated text
            updateTranscript(entryId, { 
              translatedText: result.translatedText,
              translatedLanguage: targetLanguage
            });
          }
        } catch (err) {
          console.error('[Translation] Client-side failure:', err);
          // Fallback handled by keeping original text in translatedText
        }
      }

      // Send the entry to participants.
      // If no client-side keys, the server will own translation and translated TTS.
      if (onTranslationComplete) {
        console.log(`[Transcript] Broadcasting entry:`, entry);
        onTranslationComplete(entry);
      }
      
      setProcessingStatus({ stage: 'listening', message: 'جاري الاستماع...' });

    } catch (err) {
      console.error('Processing error:', err);
      setProcessingStatus({ stage: 'error', message: 'خطأ في المعالجة' });
    } finally {
      setTimeout(() => { lastTranslatedTextRef.current = ''; }, 500);
    }
  }, [addTranscript, updateTranscript, setProcessingStatus, geminiApiKey, groqApiKey]);

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

  return { processRecognizedText, speakText, cancelPendingTranslation };
}
