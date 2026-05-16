const GEMINI_API_KEY = 'AIzaSyDXCXhA8x1LoGIN3WeXjb1QjSQ8MMISvxo';

async function testTranslation(text, sourceLang, targetLang) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const systemPrompt = `You are a strict real-time translator bridge.
Translate from ${sourceLang} to ${targetLang}.
RULES:
1. Return ONLY the direct translation.
2. No explanations, no quotes, no labels.
3. Preserve the tone and meaning.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nText: ${text}` }]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) {
      console.error(`Error: ${response.status}`);
      const err = await response.text();
      console.error(err);
      return;
    }

    const data = await response.json();
    const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`Original (${sourceLang}): ${text}`);
    console.log(`Translated (${targetLang}): ${translated}`);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

console.log('--- Testing Arabic to English ---');
await testTranslation('إزيك يا صاحبي عامل إيه؟', 'Arabic', 'English');

console.log('\n--- Testing English to Arabic ---');
await testTranslation('Hello my friend, how are you doing today?', 'English', 'Arabic');
