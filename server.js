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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'beaa621826694aca94541211f9d66d29';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); 

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'talkbridge-pro',
    groqConfigured: Boolean(GROQ_API_KEY),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY)
  });
});

app.use(express.static(path.join(__dirname, 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const rooms = {};
const roomConfigs = {};

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

/**
 * PRO-GRADE TRANSLATION ENGINE (Groq -> Gemini -> Groq Fallback)
 */
async function translateText(text, sourceLang, targetLang, customApiKey = '') {
  if (!text || sourceLang === targetLang) return text;
  
  // PRIMARY: Groq (Ultra-fast for real-time)
  if (GROQ_API_KEY) {
    try {
      const srcName = LANG_NAMES[sourceLang] || sourceLang;
      const tgtName = LANG_NAMES[targetLang] || targetLang;
      const systemPrompt = `You are a professional real-time translator. Translate from ${srcName} to ${tgtName}. Return ONLY the translation. Maintain casual/slang tone.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
          temperature: 0,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return cleanTranslatedText(data.choices?.[0]?.message?.content) || text;
      }
    } catch (err) {
      console.warn('[Groq] Failed, falling back...');
    }
  }

  // SECONDARY: Gemini
  const apiKey = customApiKey || GEMINI_API_KEY;
  if (!apiKey) return text;

  try {
    const srcName = LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = LANG_NAMES[targetLang] || targetLang;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const systemPrompt = `Professional real-time translator. ${srcName} to ${tgtName}. NO explanations. FOR ARABIC: Use Egyptian slang.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nText: ${text}` }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 500 }
      })
    });
    if (response.ok) {
      const data = await response.json();
      return cleanTranslatedText(data.candidates?.[0]?.content?.parts?.[0]?.text) || text;
    }
  } catch (err) {
    console.error('All translation providers failed');
  }
  return text;
}

const ELEVENLABS_VOICES = {
  ar: 'cjVigY5qzO86Huf0OWal', en: 'EXAVITQu4vr4xnSDxMaL', es: 'jBpfuIE2acCO8z3wKNLl',
  fr: 'XB0fDUnXU5powFXDhCwa', de: 'zcAOhNBS3c14rBihAFp1', zh: 'XB0fDUnXU5powFXDhCwa',
  ja: 'MF3mGyEYCl7XYWbV9V6O', ko: 'jBpfuIE2acCO8z3wKNLl', hi: 'onwK4e9ZLuTAKqWW03F9',
  pt: 'jBpfuIE2acCO8z3wKNLl', ru: 'XB0fDUnXU5powFXDhCwa', tr: 'onwK4e9ZLuTAKqWW03F9', it: 'jBpfuIE2acCO8z3wKNLl',
};

async function generateTTS(text, language, customApiKey = '') {
  if (!text) return '';
  const apiKey = customApiKey || ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('No TTS API Key');
  
  // Use custom voice ID if provided, otherwise fallback to language map
  const voiceId = ELEVENLABS_VOICE_ID || ELEVENLABS_VOICES[language] || ELEVENLABS_VOICES.en;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
      }),
    });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
  } catch (err) {
    console.error('TTS error:', err);
  }
  return '';
}

io.on('connection', (socket) => {
  socket.on('join-room', (payload, callback) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = {};
    participant.socketId = socket.id;
    rooms[roomId][socket.id] = participant;
    io.in(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
    if (callback) callback({ status: 'ok', participants: Object.values(rooms[roomId]) });
  });

  socket.on('update-room-config', (payload) => {
    const { roomId, config } = payload;
    if (!roomId || !config) return;
    const nid = roomId.trim().toLowerCase();
    roomConfigs[nid] = { ...roomConfigs[nid], ...config };
  });

  socket.on('chat-message', (payload) => {
    let { roomId, message } = payload;
    socket.to(roomId.trim().toLowerCase()).emit('chat-message', { message });
  });

  socket.on('update-participant', (payload) => {
    let { roomId, participant } = payload;
    roomId = roomId.trim().toLowerCase();
    if (rooms[roomId] && rooms[roomId][socket.id]) {
      rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], ...participant };
      io.in(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
    }
  });

  socket.on('raw-transcript', async (payload) => {
    let { roomId, transcriptEntry } = payload;
    roomId = roomId.trim().toLowerCase();
    io.in(roomId).emit('transcript-update', { transcriptEntry });

    const participants = Object.values(rooms[roomId] || {});
    const rConfig = roomConfigs[roomId] || {};
    
    for (const p of participants) {
      if (p.socketId === socket.id) continue;
      (async () => {
        const srcLang = transcriptEntry.originalLanguage || 'ar';
        const tgtLang = p.language || 'en';
        let translatedText = await translateText(transcriptEntry.originalText, srcLang, tgtLang, rConfig.geminiApiKey);
        let audioBase64 = await generateTTS(translatedText, p.language, rConfig.elevenLabsApiKey);

        io.to(p.socketId).emit('translated-audio', {
          originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
          originalText: transcriptEntry.originalText, translatedText,
          translatedLanguage: p.language, audioBase64
        });
      })();
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId][socket.id]) {
        delete rooms[roomId][socket.id];
        if (Object.keys(rooms[roomId]).length === 0) {
          delete rooms[roomId]; delete roomConfigs[roomId];
        } else {
          io.to(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

// Catch-all to support React Router SPA (MUST be after API routes)
app.get('*', (req, res) => {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    res.status(404).send('Build not found. Please run npm run build.');
  }
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`[TalkBridge Pro] Running on port ${PORT}`));
