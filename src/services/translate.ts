/**
 * Translation Service - خدمة الترجمة
 * دعم كامل للعربية المصرية والسعودية
 */

import { getLanguageName } from '@/config/languages';
import { translateTextGemini } from './gemini';

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string,
  fallbackApiKey?: string
): Promise<TranslationResult> {
  const cleanText = text?.trim();
  if (!cleanText || cleanText.length < 1) return { translatedText: '', sourceLanguage, targetLanguage };
  if (sourceLanguage === targetLanguage) return { translatedText: cleanText, sourceLanguage, targetLanguage };

  const srcName = getLanguageName(sourceLanguage);
  const tgtName = getLanguageName(targetLanguage);

  // 1. Try Gemini first if it looks like a Gemini key
  if (apiKey?.startsWith('AIza')) {
    try {
      const translatedText = await translateTextGemini(cleanText, sourceLanguage, targetLanguage, apiKey);
      if (translatedText && translatedText !== cleanText) {
        console.log(`✅ Gemini Translated: "${translatedText}"`);
        return { translatedText, sourceLanguage, targetLanguage };
      }
    } catch (err) {
      console.warn('Gemini failed, trying Groq fallback...');
    }
  }

  // 2. Try Groq (either if Gemini failed or if it's a Groq key)
  const groqKey = (apiKey?.startsWith('gsk_') ? apiKey : fallbackApiKey) || import.meta.env.VITE_GROQ_API_KEY || '';
  
  if (groqKey) {
    try {
      const systemPrompt = `Translate from ${srcName} to ${tgtName}. Return ONLY the direct translation.`;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: cleanText },
          ],
          temperature: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translatedText = data.choices?.[0]?.message?.content?.trim() || cleanText;
        console.log(`✅ Groq Translated: "${translatedText}"`);
        return { translatedText, sourceLanguage, targetLanguage };
      }
    } catch (err) {
      console.error('Groq fallback failed:', err);
    }
  }

  return { translatedText: cleanText, sourceLanguage, targetLanguage };
}
