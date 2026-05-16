/**
 * Gemini Translation Service
 */

export async function translateTextGemini(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<string> {
  const cleanText = text?.trim();
  if (!cleanText || sourceLanguage === targetLanguage) return cleanText;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a professional real-time conversational translator.
Translate from ${sourceLanguage} to ${targetLanguage}.

RULES:
1. Return ONLY the direct translation.
2. No explanations, no quotes, no labels.
3. Preserve the tone, slang, and meaning.
${targetLanguage === 'ar' ? '4. IMPORTANT: For Arabic, use natural, conversational "White Arabic" or "Egyptian Dialect". Avoid formal Fusha. Speak like a friend (e.g., use "إزيك", "تمام", "ماشي").' : ''}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nText to translate: ${cleanText}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    
    // Clean potential markdown or labels
    translated = translated
      .replace(/^["'«»]|["'«»]$/g, '')
      .replace(/^(Translation|الترجمة|ترجمة):\s*/i, '')
      .trim();

    return translated;
  } catch (error) {
    console.error('Gemini Translation Error:', error);
    return cleanText; // Fallback to original
  }
}

/**
 * Gemini Speech-to-Text (Transcribe)
 */
export async function transcribeAudioGemini(
  audioBlob: Blob,
  apiKey: string,
  language: string
): Promise<string> {
  if (audioBlob.size < 1000) return '';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    // Convert blob to base64
    const base64Audio = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(audioBlob);
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Transcribe this audio in ${language}. Return ONLY the transcribed text.` },
            {
              inline_data: {
                mime_type: audioBlob.type || 'audio/webm',
                data: base64Audio
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini STT Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  } catch (error) {
    console.error('Gemini STT Error:', error);
    return '';
  }
}
