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

console.log(`[TalkBridge] Server starting with hardcoded keys.`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware for logging
app.use((req, res, next) => {
  if (req.url !== '/api/health') console.log(`[TalkBridge] ${req.method} ${req.url}`);
  next();
});

// API: Health Check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hardcoded: true });
});

const LANG_NAMES = {
  ar: 'Arabic', en: 'English', fr: 'French', de: 'German',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', tr: 'Turkish',
  nl: 'Dutch', pl: 'Polish', hi: 'Hindi', fa: 'Persian',
  uk: 'Ukrainian', bn: 'Bengali', ur: 'Urdu', he: 'Hebrew',
  id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese',
};

function cleanTranslatedText(value) {
  return String(value || '')
    .trim()
    .replace(/^["'«»]|["'«»]$/g, '')
    .replace(/^(Translation|Translated text|الترجمة|ترجمة):\s*/i, '')
    .trim();
}

// Utility: Translation Logic
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
      const result = cleanTranslatedText(data.choices?.[0]?.message?.content);
      console.log(`[Translate] ${sourceLang}->${targetLang}: "${text}" -> "${result}"`);
      return result || text;
    } else {
      console.error(`[Translate] Groq Failed: ${response.status}`);
    }
  } catch (err) {
    console.error('[Translate] Error:', err.message);
  }
  return text;
}

// API: Direct Translation (for Chat)
app.post('/api/translate', async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;
  try {
    const translated = await translateText(text, sourceLang, targetLang);
    res.json({ ok: true, translated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Utility: TTS Logic
async function generateTTS(text, language) {
  if (!text) return '';
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
      }),
    });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log(`[TTS] Success: ${buffer.byteLength} bytes`);
      return Buffer.from(buffer).toString('base64');
    } else {
      const errText = await response.text();
      console.error(`[TTS] ElevenLabs Failed: ${response.status} - ${errText}`);
    }
  } catch (err) {
    console.error('[TTS] Error:', err.message);
  }
  return '';
}

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log(`[Socket] + User ${socket.id} connected`);

  socket.on('join-room', (payload, callback) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = {};
    participant.socketId = socket.id;
    rooms[roomId][socket.id] = participant;
    
    console.log(`[Socket] ${participant.name} joined ${roomId}`);
    const participants = Object.values(rooms[roomId]);
    io.in(roomId).emit('room-state', { participants });
    if (callback) callback({ status: 'ok', participants });
  });

  socket.on('raw-transcript', async (payload) => {
    let { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;
    roomId = roomId.trim().toLowerCase();
    
    console.log(`[Socket] Transcript in ${roomId}: "${transcriptEntry.originalText}"`);
    
    // 1. Broadcast original immediately
    io.in(roomId).emit('transcript-update', { transcriptEntry });
    
    // 2. Process translation and audio for others
    const pList = Object.values(rooms[roomId] || {});
    for (const p of pList) {
      if (p.socketId === socket.id) continue;
      
      (async () => {
        const src = transcriptEntry.originalLanguage || 'ar';
        const tgt = p.language || 'en';
        
        try {
          const translated = await translateText(transcriptEntry.originalText, src, tgt);
          const audio = await generateTTS(translated, tgt);
          
          console.log(`[Socket] Sending translation/audio to ${p.name}`);
          io.to(p.socketId).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerName: transcriptEntry.speakerName,
            originalText: transcriptEntry.originalText,
            translatedText: translated,
            translatedLanguage: tgt,
            audioBase64: audio
          });
        } catch (e) {
          console.error(`[Socket] Bridge Error for ${p.name}:`, e.message);
        }
      })();
    }
  });

  socket.on('chat-message', (payload) => {
    let { roomId, message } = payload;
    if (!roomId || !message) return;
    console.log(`[Socket] Chat in ${roomId}: ${message.text}`);
    socket.to(roomId.trim().toLowerCase()).emit('chat-message', { message });
  });

  socket.on('update-participant', (payload) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();
    if (rooms[roomId] && rooms[roomId][socket.id]) {
      rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], ...participant };
      io.in(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] - User ${socket.id} disconnected`);
    for (const rid in rooms) {
      if (rooms[rid][socket.id]) {
        const name = rooms[rid][socket.id].name;
        delete rooms[rid][socket.id];
        console.log(`[Socket] ${name} left ${rid}`);
        if (Object.keys(rooms[rid]).length === 0) delete rooms[rid];
        else io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
      }
    }
  });
});

app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`[TalkBridge Pro] API running on port ${PORT}`));
