/**
 * Speech-to-Text Service - التعرف على الكلام
 * دعم العربية المصرية مع Groq Whisper
 */

interface STTResult {
  text: string;
  language: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  language: string
): Promise<STTResult> {
  if (!apiKey) {
    throw new Error('مفتاح Groq API مطلوب للتعرف على الكلام');
  }

  // تحقق من حجم الملف
  if (audioBlob.size < 1000) {
    console.log('⚠️ Audio too small, skipping transcription');
    return { text: '', language };
  }

  const formData = new FormData();
  
  // تحديد نوع الملف
  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  
  formData.append('file', audioBlob, `audio.${extension}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  
  // تعيين اللغة للعربية
  if (language === 'ar') {
    formData.append('language', 'ar');
  } else {
    formData.append('language', language);
  }

  try {
    console.log(`🎤 Transcribing audio (${(audioBlob.size / 1024).toFixed(1)}KB, ${language})...`);
    
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('STT API Error:', response.status, errorText);
      
      // إذا كان الخطأ بسبب الملف، ارجع نص فارغ
      if (response.status === 400) {
        return { text: '', language };
      }
      
      throw new Error(`فشل التعرف على الكلام: ${response.status}`);
    }

    const data = await response.json();
    const text = data.text?.trim() ?? '';
    
    // تجاهل النصوص القصيرة جداً أو غير المفيدة
    if (text.length < 2 || text === '.' || text === '...' || text === '،') {
      return { text: '', language };
    }
    
    console.log(`✅ Transcribed: "${text}"`);
    
    return { text, language };
  } catch (error) {
    console.error('STT Error:', error);
    // لا ترمي خطأ، ارجع نص فارغ
    return { text: '', language };
  }
}
