/**
 * Translation Service - خدمة الترجمة
 * دعم كامل للعربية المصرية والسعودية
 */

import { getLanguageName } from '@/config/languages';

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<TranslationResult> {
  // التحقق من وجود نص
  const cleanText = text?.trim();
  
  if (!cleanText || cleanText.length < 1) {
    console.log('⚠️ No text to translate');
    return { translatedText: '', sourceLanguage, targetLanguage };
  }

  if (!apiKey) {
    throw new Error('مفتاح Groq API مطلوب');
  }

  // نفس اللغة
  if (sourceLanguage === targetLanguage) {
    return { translatedText: cleanText, sourceLanguage, targetLanguage };
  }

  const srcName = getLanguageName(sourceLanguage);
  const tgtName = getLanguageName(targetLanguage);

  // نظام ترجمة محسّن للعربية المصرية
  const systemPrompt = `أنت مترجم فوري محترف. ترجم من ${srcName} إلى ${tgtName}.

قواعد مهمة جداً:
1. اكتب الترجمة فقط، بدون أي كلام إضافي
2. لا تكتب "الترجمة:" أو أي مقدمة
3. لا تضع علامات اقتباس
4. إذا كان النص قصير جداً أو غير مفهوم، حاول ترجمته بأفضل شكل

${sourceLanguage === 'ar' ? `
للعربية المصرية:
- "إزيك" = How are you
- "عامل إيه" = How are you doing
- "تمام" = Great/Fine
- "الحمد لله" = I'm good / Thank God
- "أيوه" = Yes
- "لأ" = No
- "ماشي" = OK/Alright
- "خلاص" = Done/That's it
- "يلا" = Let's go
- "إن شاء الله" = God willing

للعربية السعودية:
- "كيفك" = How are you
- "وش لونك" = How are you
- "زين" = Good
- "تمام" = Good
- "إيه" = Yes
- "لا" = No
` : ''}

${targetLanguage === 'ar' ? `
عند الترجمة للعربية:
- استخدم العربية الفصحى البسيطة
- أو يمكنك استخدام المصرية إذا كان السياق غير رسمي
` : ''}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: cleanText },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Translation API Error:', response.status, errorText);
      throw new Error(`فشلت الترجمة: ${response.status}`);
    }

    const data = await response.json();
    let translatedText = data.choices?.[0]?.message?.content?.trim() ?? '';
    
    // تنظيف النص
    translatedText = translatedText
      .replace(/^["'«»]|["'«»]$/g, '')
      .replace(/^(Translation|الترجمة|ترجمة):\s*/i, '')
      .trim();

    console.log(`✅ Translated [${sourceLanguage}→${targetLanguage}]: "${cleanText}" → "${translatedText}"`);

    return { translatedText, sourceLanguage, targetLanguage };
  } catch (error) {
    console.error('Translation Error:', error);
    throw error;
  }
}
