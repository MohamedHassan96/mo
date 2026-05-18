/**
 * Text-to-Speech Service
 * صوت عربي مصري طبيعي مع ElevenLabs
 */

import type { TTSProvider } from '@/types';

interface TTSOptions {
  text: string;
  language: string;
  provider: TTSProvider;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  xttsUrl?: string;
  xttsApiToken?: string;
}

// ─── أصوات ElevenLabs - صوت مصري للعربية ─────────────────────
export const ELEVENLABS_VOICES = {
  // العربية المصرية - أصوات مصرية حقيقية
  ar: { 
    id: 'c06fdbaa06e04b6cbe80fb460336f064', // صوت مصري مخصص
    name: 'Egyptian Arabic (Premium)',
    fallbacks: ['pNInz6obpgDQGcFmaJgB', 'cjVigY5qzO86Huf0OWal', 'onwK4e9ZLuTAKqWW03F9']
  },
  
  // الإنجليزية
  en: { 
    id: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    name: 'Sarah',
    fallbacks: ['21m00Tcm4TlvDq8ikWAM']
  },
  
  es: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', fallbacks: [] },
  fr: { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', fallbacks: [] },
  de: { id: 'zcAOhNBS3c14rBihAFp1', name: 'Hannah', fallbacks: [] },
  zh: { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', fallbacks: [] },
  ja: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Emily', fallbacks: [] },
  ko: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', fallbacks: [] },
  hi: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', fallbacks: [] },
  pt: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', fallbacks: [] },
  ru: { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', fallbacks: [] },
  tr: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', fallbacks: [] },
  it: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', fallbacks: [] },
};

// ─── Main TTS Function ──────────────────────────────────────────

export async function synthesizeSpeech(options: TTSOptions): Promise<Blob | null> {
  const { provider } = options;

  switch (provider) {
    case 'elevenlabs':
      if (!options.elevenLabsApiKey) {
        console.warn('ElevenLabs API key is missing; using browser speech fallback.');
        return synthesizeSpeechBrowser(options.text, options.language);
      }
      return synthesizeSpeechElevenLabs(
        options.text,
        options.elevenLabsApiKey || '',
        options.elevenLabsVoiceId,
        options.language
      );
    case 'coqui':
      return synthesizeSpeechCoqui(options);
    case 'browser':
    default:
      return synthesizeSpeechBrowser(options.text, options.language);
  }
}

// ─── ElevenLabs TTS - صوت مصري ─────────────────────────────────

export async function synthesizeSpeechElevenLabs(
  text: string,
  apiKey: string,
  voiceId?: string,
  language?: string
): Promise<Blob> {
  if (!apiKey) {
    throw new Error('مفتاح ElevenLabs API مطلوب');
  }

  const langCode = language || 'ar';
  const voiceInfo = ELEVENLABS_VOICES[langCode as keyof typeof ELEVENLABS_VOICES] || ELEVENLABS_VOICES.ar;
  const selectedVoiceId = voiceId || voiceInfo.id;

  console.log(`🔊 TTS [${langCode}]: "${text.substring(0, 30)}..." → Voice: ${voiceInfo.name}`);

  const isArabic = langCode === 'ar';

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          language_code: langCode,
          voice_settings: {
            stability: isArabic ? 0.38 : 0.35,
            similarity_boost: 0.8,
            style: isArabic ? 0.7 : 0.65,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs Error:', response.status, errorText);
      
      // جرب الأصوات البديلة
      if (voiceInfo.fallbacks && voiceInfo.fallbacks.length > 0) {
        for (const fallbackId of voiceInfo.fallbacks) {
          if (fallbackId !== selectedVoiceId) {
            console.log('Trying fallback voice:', fallbackId);
            try {
              return await synthesizeSpeechElevenLabs(text, apiKey, fallbackId, language);
            } catch {
              continue;
            }
          }
        }
      }
      
      throw new Error(`فشل ElevenLabs: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('TTS Error:', error);
    throw error;
  }
}

// ─── Coqui XTTS ─────────────────────────────────────────────────

async function synthesizeSpeechCoqui(options: TTSOptions): Promise<Blob> {
  const { text, language, xttsUrl, xttsApiToken } = options;

  if (!xttsUrl) throw new Error('رابط XTTS مطلوب');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (xttsApiToken) headers['Authorization'] = `Bearer ${xttsApiToken}`;

  const response = await fetch(`${xttsUrl}/api/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, language, speaker_wav: '' }),
  });

  if (!response.ok) throw new Error(`فشل Coqui XTTS: ${response.status}`);
  return await response.blob();
}

// ─── Browser Web Speech API ─────────────────────────────────────

export function synthesizeSpeechBrowser(text: string, language: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'ar' ? 'ar-EG' : language; // مصري
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => 
      v.lang.includes('ar-EG') || v.lang.includes('ar')
    );
    if (arabicVoice) utterance.voice = arabicVoice;

    utterance.onend = () => resolve(null);
    utterance.onerror = () => resolve(null);
    window.speechSynthesis.speak(utterance);
  });
}

// ─── Play Audio ─────────────────────────────────────────────────

export function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    audio.play().catch(reject);
  });
}

export async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}

export async function getElevenLabsVoices(apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return [];
  }
}
