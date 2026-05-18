import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

loadLocalEnv();

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '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').trim();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDXCXhA8x1LoGIN3WeXjb1QjSQ8MMISvxo';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'c06fdbaa06e04b6cbe80fb460336f064';
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'elevenlabs';
const XTTS_URL = process.env.XTTS_URL || 'http://localhost:8080';
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';

console.log(`[TalkBridge Pro] SYSTEM ACTIVE — Operational Logic Synced.`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'talkbridge',
    socketPath: '/socket-signal',
    groqConfigured: Boolean(GROQ_API_KEY),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY),
    elevenLabsVoiceConfigured: Boolean(ELEVENLABS_VOICE_ID)
  });
});

// Serve Frontend Build
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

const LANG_NAMES = {
  ar: 'Arabic', en: 'English', fr: 'French', de: 'German',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', tr: 'Turkish',
  nl: 'Dutch', pl: 'Polish', hi: 'Hindi', fa: 'Persian',
  uk: 'Ukrainian', bn: 'Bengali', ur: 'Urdu', he: 'Hebrew',
  id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese',
  fil: 'Filipino', sw: 'Swahili', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', el: 'Greek', ro: 'Romanian',
  cs: 'Czech', hu: 'Hungarian', bg: 'Bulgarian',
};

function cleanTranslatedText(value) {
  return String(value || '')
    .trim()
    .replace(/^["'«»]|["'«»]$/g, '')
    .replace(/^(Translation|Translated text|الترجمة|ترجمة)\s*:\s*/i, '')
    .trim();
}

function hasTranslatedAudioText(originalText, translatedText, sourceLang, targetLang) {
  const original = String(originalText || '').trim();
  const translated = String(translatedText || '').trim();
  return Boolean(
    sourceLang !== targetLang &&
    original &&
    translated &&
    translated !== original
  );
}

/**
 * Fix Arabic text for LTR terminals by reversing it if needed.
 */
function fixRTLForConsole(text) {
  if (!text) return '';
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    // Simple reverse for terminal visibility
    return text.split('').reverse().join('');
  }
  return text;
}

// Helper: Translation API (Gemini Slang-Aware)
async function translateTextGemini(text, sourceLang, targetLang) {
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const systemPrompt = `You are a professional real-time SLANG-AWARE conversational translator bridge.
Translate from ${srcName} to ${tgtName}.

RULES:
1. Return ONLY the direct translation. No explanations.
2. Maintain the EXACT VIBE and SLANG of the speaker.
3. FOR ARABIC (Target): Use deep Egyptian/White Arabic. Use "إزيك", "عامل إيه", "قشطة", "فل", "ماشي", "يا صاحبي", "يا باشا", "يا وحش", "على وضعه", "تسلم", "حبيبي". AVOID "كيف حالك", "حسناً".
4. FOR ENGLISH (Target): Use casual, natural slang. Use "What's up", "Bro", "Cool", "I'm down", "Gotcha", "No worries", "Solid", "Legit".

EXAMPLES:
- "What's up bro" -> "إيه الكلام يا صاحبي؟"
- "That's legit" -> "ده على وضعه والله"
- "I'm down for that" -> "قشطة أنا معاك"
- "فكك مني" -> "Get off my back"
- "منور يا وحش" -> "Good to see you, legend"
- "I'm so tired" -> "أنا مقتول من التعب"
- "Take care" -> "خلي بالك من نفسك يا بطل"`;

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
    throw new Error(`Gemini translation failed: ${response.status}`);
  }

  const data = await response.json();
  const translated = cleanTranslatedText(data.candidates?.[0]?.content?.parts?.[0]?.text);

  if (!translated || translated === text) {
    throw new Error('Gemini returned empty or invalid translation');
  }

  return translated;
}

async function translateTextGoogleFree(text, sourceLang, targetLang) {
  try {
    console.log(`[Translation] Attempting Free Google Translate fallback from ${sourceLang} to ${targetLang}...`);
    const sl = sourceLang === 'ar' ? 'ar' : sourceLang;
    const tl = targetLang === 'ar' ? 'ar' : targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Free Translate HTTP error: ${response.status}`);
    
    const data = await response.json();
    if (data && data[0]) {
      const translatedParts = data[0].map(part => part[0]).join('');
      console.log(`[Translation] Free Google Translate successfully translated: "${translatedParts}"`);
      return translatedParts;
    }
    throw new Error('Invalid translation response format');
  } catch (err) {
    console.error('[Translation] Free Google Translate failed:', err.message);
    throw err;
  }
}

// Helper: Translation Orchestrator
async function translateText(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;

  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('LoGIN')) {
    try {
      console.log(`[Translation] Attempting Gemini translation from ${sourceLang} to ${targetLang}...`);
      const geminiTranslated = await translateTextGemini(text, sourceLang, targetLang);
      if (geminiTranslated && geminiTranslated !== text) {
        return geminiTranslated;
      }
      console.warn('[Translation] Gemini returned original text, trying Groq fallback...');
    } catch (err) {
      console.warn('[Translation] Gemini failed, trying Groq fallback:', err.message);
    }
  }

  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_groq')) {
    try {
      console.log(`[Translation] Attempting Groq translation from ${sourceLang} to ${targetLang}...`);
      return await translateTextGroq(text, sourceLang, targetLang);
    } catch (err) {
      console.error('[Translation] Groq translation also failed:', err.message);
    }
  }

  // ULTIMATE RESILIENT FALLBACK: Free Google Translate API
  try {
    return await translateTextGoogleFree(text, sourceLang, targetLang);
  } catch (err) {
    console.error('[Translation] Ultimate fallback failed, returning original text:', err.message);
    return text;
  }
}

async function translateTextGroq(text, sourceLang, targetLang) {
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = `Translate speech from ${srcName} to ${tgtName}. Return only the natural conversational translation, no labels, no quotes.`;

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'gemma2-9b-it', 'llama-3.2-3b-preview'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Translation] Trying Groq model ${model} for ${sourceLang} -> ${targetLang}...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0,
          max_tokens: 160,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translated = cleanTranslatedText(data.choices?.[0]?.message?.content) || text;
        if (translated && translated !== text) {
          console.log(`[Translation] Groq successfully translated with model ${model}: "${translated}"`);
          return translated;
        }
      } else {
        const errorText = await response.text();
        console.warn(`[Translation] Groq model ${model} failed:`, response.status, errorText);
      }
    } catch (err) {
      console.warn(`[Translation] Groq model ${model} error:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All Groq translation models failed');
}

const ELEVENLABS_VOICES = {
  ar: 'c06fdbaa06e04b6cbe80fb460336f064', // Egyptian Arabic
  en: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  es: 'jBpfuIE2acCO8z3wKNLl', // Gigi
  fr: 'XB0fDUnXU5powFXDhCwa', // Charlotte
  de: 'zcAOhNBS3c14rBihAFp1', // Hannah
  zh: 'XB0fDUnXU5powFXDhCwa', // Charlotte
  ja: 'MF3mGyEYCl7XYWbV9V6O', // Emily
  ko: 'jBpfuIE2acCO8z3wKNLl', // Gigi
  hi: 'onwK4e9ZLuTAKqWW03F9', // Daniel
  pt: 'jBpfuIE2acCO8z3wKNLl', // Gigi
  ru: 'XB0fDUnXU5powFXDhCwa', // Charlotte
  tr: 'onwK4e9ZLuTAKqWW03F9', // Daniel
  it: 'jBpfuIE2acCO8z3wKNLl', // Gigi
};

async function transcribeAudioElevenLabs(audioBuffer, mimeType, language, apiKey) {
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('mpeg') || mimeType.includes('mp3')
        ? 'mp3'
        : 'webm';
  const formData = new FormData();

  formData.append('model_id', 'scribe_v2');
  formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `speech.${extension}`);
  if (language) formData.append('language_code', language === 'ar' ? 'ar' : language);
  formData.append('tag_audio_events', 'false');
  formData.append('timestamps_granularity', 'none');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ElevenLabs STT failed: ${response.status} ${data.detail || data.message || ''}`.trim());
  }

  return {
    text: cleanTranslatedText(data.text),
    language: data.language_code || language,
  };
}

async function transcribeAudioGroq(audioBuffer, mimeType, language) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `speech.${extension}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  if (language) formData.append('language', language === 'ar' ? 'ar' : language);
  if (language === 'ar') {
    formData.append('prompt', 'الكلام بالعامية المصرية واللغة العربية الحية والعبارات الكاجوال مثل: إزيك، عامل إيه، تمام، قشطة، ماشي، يا باشا، يا صاحبي، ده، كده، إيه، هو، بص.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Groq STT failed: ${response.status} ${data.error?.message || ''}`.trim());
  }

  return {
    text: cleanTranslatedText(data.text),
    language,
  };
}

async function transcribeAudio(audioBuffer, mimeType, language, clientElevenLabsKey = '') {
  if (!audioBuffer?.length || audioBuffer.length < 300) {
    return { text: '', language };
  }

  if (GROQ_API_KEY) {
    try {
      return await transcribeAudioGroq(audioBuffer, mimeType, language);
    } catch (err) {
      console.warn('[STT] Groq failed, trying ElevenLabs fallback if configured:', err.message);
    }
  }

  const elevenLabsKey = clientElevenLabsKey || ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    return transcribeAudioElevenLabs(audioBuffer, mimeType, language, elevenLabsKey);
  }

  return transcribeAudioGroq(audioBuffer, mimeType, language);
}

// Helper: TTS API Call
// Helper: TTS API Call
async function makeElevenLabsRequest(text, language, apiKey, voiceId) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { 
        stability: 0.40, 
        similarity_boost: 0.80,
        style: 0.50,
        use_speaker_boost: true
      },
      language_code: language,
    }),
  });
  
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
  const errorText = await response.text();
  throw new Error(`ElevenLabs TTS failed with status ${response.status}: ${errorText}`);
}

async function generateTTSWithKey(text, language, apiKey, customVoiceId) {
  const voiceId = customVoiceId || ELEVENLABS_VOICE_ID || ELEVENLABS_VOICES[language] || 'EXAVITQu4vr4xnSDxMaL';
  
  try {
    return await makeElevenLabsRequest(text, language, apiKey, voiceId);
  } catch (err) {
    console.warn(`[TTS] Primary Voice ID ${voiceId} failed: ${err.message}. Trying standard fallback...`);
    
    const fallbackVoices = {
      ar: 'pNInz6obpgDQGcFmaJgB', // Adam (standard natural Arabic)
      en: 'EXAVITQu4vr4xnSDxMaL', // Sarah
      es: 'jBpfuIE2acCO8z3wKNLl', // Gigi
      fr: 'XB0fDUnXU5powFXDhCwa', // Charlotte
      de: 'zcAOhNBS3c14rBihAFp1', // Hannah
      zh: 'XB0fDUnXU5powFXDhCwa', // Charlotte
      ja: 'MF3mGyEYCl7XYWbV9V6O', // Emily
      ko: 'jBpfuIE2acCO8z3wKNLl', // Gigi
      hi: 'onwK4e9ZLuTAKqWW03F9', // Daniel
      pt: 'jBpfuIE2acCO8z3wKNLl', // Gigi
      ru: 'XB0fDUnXU5powFXDhCwa', // Charlotte
      tr: 'onwK4e9ZLuTAKqWW03F9', // Daniel
      it: 'jBpfuIE2acCO8z3wKNLl', // Gigi
    };
    
    const fallbackVoiceId = fallbackVoices[language] || 'EXAVITQu4vr4xnSDxMaL';
    if (fallbackVoiceId === voiceId) {
      const secondaryBackup = 'EXAVITQu4vr4xnSDxMaL'; // Sarah
      console.log(`[TTS] Trying secondary generic backup: ${secondaryBackup}`);
      return await makeElevenLabsRequest(text, language, apiKey, secondaryBackup);
    }
    
    console.log(`[TTS] Trying standard language fallback voice: ${fallbackVoiceId}`);
    return await makeElevenLabsRequest(text, language, apiKey, fallbackVoiceId);
  }
}

async function generateTTS(text, language, customVoiceId) {
  if (!text) return '';
  if (TTS_PROVIDER === 'browser') {
    return '';
  }
  const keys = [
    'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056',
    process.env.ELEVENLABS_API_KEY,
    'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126'
  ].filter(Boolean);

  let lastError = null;
  for (const key of keys) {
    try {
      console.log(`[TTS] Attempting generation with key ending in ...${key.slice(-6)}`);
      return await generateTTSWithKey(text, language, key, customVoiceId);
    } catch (err) {
      console.warn(`[TTS] Failed with key ...${key.slice(-6)}:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('No working ElevenLabs API keys configured');
}

// REST API Fallbacks (Guaranteed to work on Railway)
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const translated = await translateText(text, sourceLang, targetLang);
    res.json({ ok: true, translated });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'Translation failed' });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text, language } = req.body;
    const audioBase64 = await generateTTS(text, language);
    res.json({ ok: true, audioBase64 });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'TTS failed' });
  }
});

app.post('/api/stt', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }), async (req, res) => {
  try {
    const language = String(req.query.language || req.headers['x-language'] || 'ar');
    const mimeType = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
    const clientElevenLabsKey = String(req.headers['x-elevenlabs-api-key'] || '');
    const result = await transcribeAudio(req.body, mimeType, language, clientElevenLabsKey);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'Speech-to-text failed' });
  }
});

// AssemblyAI: Get Temporary Token for Real-time Streaming
app.get('/api/assemblyai-token', async (req, res) => {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'AssemblyAI API Key not configured' });
    }
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to get token');
    res.json({ ok: true, token: data.token });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


io.on('connection', (socket) => {
  console.log(`[Socket] +++ New connection request: ${socket.id} from ${socket.handshake.address}`);

  // 1. Join Room & Canonical State Sync
  socket.on('join-room', (payload, callback) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();

    // Leave old rooms
    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = {};

    participant.socketId = socket.id;
    participant.isConnected = true;
    rooms[roomId][socket.id] = participant;

    console.log(`[Socket] ${fixRTLForConsole(participant.name)} joined ${roomId}`);

    const participants = Object.values(rooms[roomId]);
    io.in(roomId).emit('room-state', { participants });

    if (callback) callback({ status: 'ok', participants });
  });

  // 2. Chat with Ack
  socket.on('chat-message', (payload, callback) => {
    let { roomId, message } = payload;
    if (!roomId || !message) return;
    roomId = roomId.trim().toLowerCase();

    // Broadcast to others in the room
    socket.to(roomId).emit('chat-message', { message });
    if (callback) callback({ status: 'sent' });
  });

  // 2.5 Participant State Update
  socket.on('update-participant', (payload) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();

    if (rooms[roomId] && rooms[roomId][socket.id]) {
      rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], ...participant };
      io.in(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
    }
  });

  // 3. Translated Text & Audio Delivery Pattern
  socket.on('raw-transcript', async (payload, callback) => {
    let { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;
    roomId = roomId.trim().toLowerCase();

    if (callback) callback({ status: 'received' });

    // Broadcast original text to everyone for instant UI update
    io.in(roomId).emit('transcript-update', { transcriptEntry });

    const participants = Object.values(rooms[roomId] || {});
    const recipients = participants.filter((p) => p.socketId !== socket.id);
    if (
      recipients.length === 0 &&
      transcriptEntry.targetLanguage &&
      transcriptEntry.targetLanguage !== transcriptEntry.originalLanguage
    ) {
      recipients.push({
        socketId: socket.id,
        language: transcriptEntry.targetLanguage,
        previewOnly: true,
      });
    }

    // Fan-out Translations
    for (const p of recipients) {
      (async () => {
        const srcLang = transcriptEntry.originalLanguage || 'ar';
        const tgtLang = p.language || 'en';
        let finalTranslatedText = transcriptEntry.translatedText || transcriptEntry.originalText;
        let translatedLanguage = transcriptEntry.translatedLanguage || srcLang;

        // Translate if languages differ AND (not already translated OR translated for different language)
        const needsTranslation = srcLang !== tgtLang && (
          !transcriptEntry.translatedLanguage ||
          transcriptEntry.translatedLanguage !== tgtLang ||
          finalTranslatedText === transcriptEntry.originalText
        );

        if (needsTranslation) {
          try {
            console.log(`[Server] Translating: ${srcLang} -> ${tgtLang}`);
            finalTranslatedText = await translateText(
              transcriptEntry.originalText,
              srcLang,
              tgtLang
            );
            translatedLanguage = tgtLang;
          } catch (err) {
            console.warn(`[Server] Translation failed, using original:`, err.message);
            finalTranslatedText = transcriptEntry.originalText;
            translatedLanguage = srcLang;
          }
        } else {
          console.log(`[Server] Using client-provided translation for ${tgtLang}`);
          translatedLanguage = transcriptEntry.translatedLanguage || tgtLang;
        }

        const shouldSpeakTranslatedAudio = hasTranslatedAudioText(
          transcriptEntry.originalText,
          finalTranslatedText,
          srcLang,
          translatedLanguage
        );

        // Generate audio only when text was actually translated for this listener.
        let audioBase64 = '';
        if (shouldSpeakTranslatedAudio && !p.previewOnly) {
          try {
            console.log(`[Server] Generating TTS for ${p.language}: "${finalTranslatedText.substring(0, 30)}..."`);
            audioBase64 = await generateTTS(finalTranslatedText, translatedLanguage, p.elevenLabsVoiceId);
          } catch (err) {
            console.warn(`[Server] TTS generation failed:`, err.message);
            audioBase64 = '';
          }
        }

        // Send direct to specific participant's socket
        io.to(p.socketId).emit('translated-audio', {
          originalId: transcriptEntry.id,
          speakerId: transcriptEntry.speakerId,
          speakerName: transcriptEntry.speakerName,
          speakerRole: transcriptEntry.speakerRole,
          originalText: transcriptEntry.originalText,
          originalLanguage: srcLang,
          translatedText: finalTranslatedText,
          translatedLanguage,
          audioBase64,
          playAudio: shouldSpeakTranslatedAudio
        });
      })();
    }
  });

  socket.on('disconnect', () => {
    for (const rid in rooms) {
      if (rooms[rid][socket.id]) {
        const name = rooms[rid][socket.id].name;
        delete rooms[rid][socket.id];
        console.log(`[Socket] - ${name} disconnected from ${rid}`);
        if (Object.keys(rooms[rid]).length === 0) delete rooms[rid];
        else io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
      }
    }
  });
});

app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Build not found. Check static assets.');
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Socket.IO Backend & Frontend] Running on http://0.0.0.0:${PORT}`);
});

// Low-level debugging
httpServer.on('upgrade', (req, socket, head) => {
  console.log(`[HTTP Upgrade Attempt] URL: ${req.url}, Headers:`, req.headers);
});
