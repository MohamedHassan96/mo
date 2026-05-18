import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── HARDCODED CONFIG (PER USER PROMPT & REFERENCE) ─────────────────────────
const GROQ_API_KEY = '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';
const ELEVENLABS_API_KEY = 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056';
const ELEVENLABS_VOICE_ID = 'c06fdbaa06e04b6cbe80fb460336f064';

console.log(`[TalkBridge Pro] SYSTEM ACTIVE — Operational Logic Synced.`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check with status reporting
app.get('/api/health', (req, res) => res.json({ ok: true, bridge: 'operational', keys: 'locked' }));

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
};

function clean(v) {
  return String(v || '').trim().replace(/^["'«»]|["'«»]$/g, '').replace(/^(Translation|الترجمة|ترجمة):\s*/i, '').trim();
}

// ─── CORE PIPELINE: TRANSLATION (GROQ llama-3.3-70b) ────────────────────────
async function translate(text, src, tgt) {
  if (!text || src === tgt) return text;
  const srcN = LANG_NAMES[src] || src;
  const tgtN = LANG_NAMES[tgt] || tgt;

  try {
    const prompt = `Professional SLANG-AWARE translator bridge. Translate from ${srcN} to ${tgtN}. 
RULES:
1. Output ONLY the translation.
2. FOR ARABIC: Use deep Egyptian slang (White Arabic). Use "قشطة", "يا باشا", "فل", "عامل إيه".
3. Maintain original intent and vibe.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }],
        temperature: 0.1,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const result = clean(data.choices?.[0]?.message?.content);
      console.log(`[Bridge] Trans: "${text}" -> "${result}"`);
      return result || text;
    }
  } catch (e) { console.error('[Bridge] Translation Failure:', e.message); }
  return text;
}

// ─── CORE PIPELINE: TTS (ELEVENLABS STREAM) ──────────────────────────────────
async function synthesize(text) {
  if (!text || text.length < 2) return '';
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true }
      }),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      console.log(`[Bridge] Audio: ${buffer.byteLength} bytes generated`);
      return Buffer.from(buffer).toString('base64');
    }
  } catch (e) { console.error('[Bridge] TTS Failure:', e.message); }
  return '';
}

// ─── SOCKET.IO OPERATIONAL LOGIC (FAN-OUT PATTERN) ──────────────────────────
io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, participant }, cb) => {
    const rid = roomId.trim().toLowerCase();
    socket.join(rid);
    if (!rooms[rid]) rooms[rid] = {};
    participant.socketId = socket.id;
    participant.isConnected = true;
    rooms[rid][socket.id] = participant;
    
    console.log(`[Socket] + ${participant.name} connected to ${rid}`);
    const currentParticipants = Object.values(rooms[rid]);
    io.to(rid).emit('room-state', { participants: currentParticipants });
    if (cb) cb({ status: 'ok', participants: currentParticipants });
  });

  socket.on('raw-transcript', async ({ roomId, transcriptEntry }, cb) => {
    const rid = roomId.trim().toLowerCase();
    if (cb) cb({ status: 'received' });

    // 1. Broadcast original immediately to all (visual feedback)
    io.to(rid).emit('transcript-update', { transcriptEntry });
    
    // 2. Process personalized bridge for others
    const others = Object.values(rooms[rid] || {}).filter(u => u.socketId !== socket.id);
    for (const u of others) {
      (async () => {
        try {
          const trans = await translate(transcriptEntry.originalText, transcriptEntry.originalLanguage, u.language);
          const audio = await synthesize(trans);
          
          io.to(u.socketId).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerName: transcriptEntry.speakerName,
            originalText: transcriptEntry.originalText,
            translatedText: trans,
            translatedLanguage: u.language,
            audioBase64: audio
          });
        } catch (err) { console.error(`[Socket] Pipeline error for ${u.name}:`, err.message); }
      })();
    }
  });

  socket.on('chat-message', async ({ roomId, message }, cb) => {
    const rid = roomId.trim().toLowerCase();
    if (cb) cb({ status: 'sent' });
    
    const others = Object.values(rooms[rid] || {}).filter(u => u.socketId !== socket.id);
    // Send original to sender
    socket.emit('chat-message', { message });

    for (const u of others) {
      (async () => {
        const trans = await translate(message.text, message.originalLanguage || 'ar', u.language || 'en');
        io.to(u.socketId).emit('chat-message', { message: { ...message, translatedText: trans } });
      })();
    }
  });

  socket.on('update-participant', ({ roomId, participant }) => {
    const rid = roomId.trim().toLowerCase();
    if (rooms[rid] && rooms[rid][socket.id]) {
      rooms[rid][socket.id] = { ...rooms[rid][socket.id], ...participant };
      io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
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
httpServer.listen(PORT, '0.0.0.0', () => console.log(`[TalkBridge Pro] API running on port ${PORT}`));
