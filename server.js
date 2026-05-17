import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- HARDCODED KEYS (Per User Request) ---
const GROQ_API_KEY = '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';
const ELEVENLABS_API_KEY = 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056';
const ELEVENLABS_VOICE_ID = 'c06fdbaa06e04b6cbe80fb460336f064';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; // Keep dynamic if exists

console.log(`[TalkBridge] API Keys Loaded (Hardcoded). Groq: YES, ElevenLabs: YES`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, keys: { groq: true, elevenLabs: true } });
});

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: { origin: "*", methods: ["GET", "POST"] }
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
};

function cleanTranslatedText(value) {
  return String(value || '').trim().replace(/^["'«»]|["'«»]$/g, '').replace(/^(Translation|Translated text|الترجمة|ترجمة):\s*/i, '').trim();
}

async function translateText(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;

  try {
    const systemPrompt = `You are a professional real-time SLANG-AWARE conversational translator. Translate from ${srcName} to ${tgtName}.
RULES:
1. Return ONLY the direct translation. No explanations.
2. Maintain EXACT VIBE and SLANG.
3. FOR ARABIC (Target): Use deep Egyptian/White Arabic. Use "إزيك", "عامل إيه", "قشطة", "فل", "ماشي", "يا صاحبي", "يا باشا". AVOID "كيف حالك", "حسناً".
4. FOR ENGLISH (Target): Use casual slang like "What's up", "Bro", "Cool", "Gotcha".`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
        temperature: 0.1,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return cleanTranslatedText(data.choices?.[0]?.message?.content) || text;
    }
  } catch (err) { console.error('[Translate] Groq Error:', err.message); }
  return text;
}

async function generateTTS(text, language) {
  if (!text) return '';
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
    });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
  } catch (err) { console.error('[TTS] Error:', err.message); }
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

  socket.on('raw-transcript', async (payload) => {
    let { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;
    roomId = roomId.trim().toLowerCase();
    
    // Broadcast original to everyone (including sender)
    io.in(roomId).emit('transcript-update', { transcriptEntry });
    
    const pList = Object.values(rooms[roomId] || {});
    for (const p of pList) {
      if (p.socketId === socket.id) continue;
      (async () => {
        const src = transcriptEntry.originalLanguage || 'ar';
        const tgt = p.language || 'en';
        let translated = await translateText(transcriptEntry.originalText, src, tgt);
        let audio = await generateTTS(translated, tgt);
        io.to(p.socketId).emit('translated-audio', {
          originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
          originalText: transcriptEntry.originalText, translatedText: translated,
          translatedLanguage: tgt, audioBase64: audio
        });
      })();
    }
  });

  socket.on('chat-message', (payload) => {
    let { roomId, message } = payload;
    if (!roomId || !message) return;
    socket.to(roomId.trim().toLowerCase()).emit('chat-message', { message });
  });

  socket.on('disconnect', () => {
    for (const rid in rooms) {
      if (rooms[rid][socket.id]) {
        delete rooms[rid][socket.id];
        if (Object.keys(rooms[rid]).length === 0) delete rooms[rid];
        else io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
      }
    }
  });
});

app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Build not found.');
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`[TalkBridge Pro] Running on port ${PORT}`));
