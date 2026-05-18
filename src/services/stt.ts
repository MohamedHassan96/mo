/**
 * Speech-to-Text Service - التعرف على الكلام
 * دعم العربية المصرية مع Gemini 1.5 Flash (و Groq Whisper كبديل)
 */

import { transcribeAudioGemini } from './gemini';

interface STTResult {
  text: string;
  language: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  language: string
): Promise<STTResult> {
  // تحقق من حجم الملف
  if (audioBlob.size < 1000) {
    console.log('⚠️ Audio too small, skipping transcription');
    return { text: '', language };
  }

  try {
    if (!apiKey || apiKey === 'server' || apiKey.startsWith('sk_')) {
      return transcribeAudioServer(audioBlob, language, apiKey.startsWith('sk_') ? apiKey : '');
    }

    if (apiKey.startsWith('gsk_')) {
      console.log(`🎤 Transcribing audio with Groq Whisper (${(audioBlob.size / 1024).toFixed(1)}KB, ${language})...`);
      return transcribeAudioGroq(audioBlob, apiKey, language);
    }

    // Try Gemini when a Gemini key is configured
    console.log(`🎤 Transcribing audio with Gemini (${(audioBlob.size / 1024).toFixed(1)}KB, ${language})...`);
    const text = await transcribeAudioGemini(audioBlob, apiKey, language);
    
    if (text) {
      console.log(`✅ Gemini Transcribed: "${text}"`);
      return { text, language };
    }

    return { text: '', language };
  } catch (error) {
    console.error('STT Error:', error);
    throw error;
  }
}

async function transcribeAudioServer(
  audioBlob: Blob,
  language: string,
  elevenLabsApiKey = ''
): Promise<STTResult> {
  console.log(`🎤 Transcribing audio via server STT (${(audioBlob.size / 1024).toFixed(1)}KB, ${language})...`);
  const response = await fetch(`/api/stt?language=${encodeURIComponent(language)}`, {
    method: 'POST',
    headers: {
      'Content-Type': audioBlob.type || 'audio/webm',
      ...(elevenLabsApiKey ? { 'x-elevenlabs-api-key': elevenLabsApiKey } : {}),
    },
    body: audioBlob,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Server STT failed: ${response.status}`);
  }

  return {
    text: data.text?.trim() ?? '',
    language: data.language || language,
  };
}

async function transcribeAudioGroq(
  audioBlob: Blob,
  apiKey: string,
  language: string
): Promise<STTResult> {
  const formData = new FormData();
  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  
  formData.append('file', audioBlob, `audio.${extension}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  formData.append('language', language === 'ar' ? 'ar' : language);

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) return { text: '', language };
  const data = await response.json();
  return { text: data.text?.trim() ?? '', language };
}
