import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CRITICAL: HARDCODED CONFIG (ULTRA-STABLE) ────────────────────────────────
const GROQ_API_KEY = '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';
const ELEVENLABS_API_KEY = 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056';
const ELEVENLABS_VOICE_ID = 'c06fdbaa06e04b6cbe80fb460336f064';

console.log(`[TalkBridge Pro] REINFORCED AUDIO BRIDGE STARTING...`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, status: 'synced' }));

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

function cleanText(v) {
  return String(v || '').trim().replace(/^["'«»]|["'«»]$/g, '').replace(/^(Translation|الترجمة|ترجمة):\s*/i, '').trim();
}

// ─── OPTIMIZED TRANSLATION ───────────────────────────────────────────────────
async function translate(text, src, tgt) {
  if (!text || src === tgt) return text;
  try {
    const prompt = `Professional SLANG-AWARE translator. ${LANG_NAMES[src]||src} to ${LANG_NAMES[tgt]||tgt}. Return ONLY the direct translation. For Arabic: use Egyptian slang.`;
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
      return cleanText(data.choices?.[0]?.message?.content) || text;
    }
  } catch (e) { console.error('[Bridge] Trans Error:', e.message); }
  return text;
}

// ─── REINFORCED TTS (ELEVENLABS) ──────────────────────────────────────────────
async function synthesize(text) {
  if (!text || text.length < 2) return '';
  try {
    console.log(`[TTS] Requesting ElevenLabs for: "${text.substring(0, 20)}..."`);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true }
      }),
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      console.log(`[TTS] Success: ${buffer.byteLength} bytes generated`);
      return Buffer.from(buffer).toString('base64');
    } else {
      const err = await res.text();
      console.error(`[TTS] ElevenLabs Failed (${res.status}):`, err);
    }
  } catch (e) { console.error('[TTS] Network Error:', e.message); }
  return '';
}

// ─── SOCKET PIPELINE (THE BRIDGE) ───────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, participant }, cb) => {
    const rid = roomId.trim().toLowerCase();
    socket.join(rid);
    if (!rooms[rid]) rooms[rid] = {};
    participant.socketId = socket.id;
    rooms[rid][socket.id] = participant;
    io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
    if (cb) cb({ status: 'ok', participants: Object.values(rooms[rid]) });
  });

  socket.on('raw-transcript', async ({ roomId, transcriptEntry }) => {
    const rid = roomId.trim().toLowerCase();
    
    // 1. Broadcast text immediately for visual feedback
    io.to(rid).emit('transcript-update', { transcriptEntry });
    
    // 2. Multi-Target Translation & TTS Bridge
    const others = Object.values(rooms[rid] || {}).filter(u => u.socketId !== socket.id);
    
    for (const u of others) {
      (async () => {
        try {
          const trans = await translate(transcriptEntry.originalText, transcriptEntry.originalLanguage, u.language);
          const audio = await synthesize(trans);
          
          if (audio) {
            console.log(`[Bridge] Sending Audio to: ${u.name} (${u.language})`);
            io.to(u.socketId).emit('translated-audio', {
              originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
              originalText: transcriptEntry.originalText, translatedText: trans,
              translatedLanguage: u.language, audioBase64: audio
            });
          } else {
            // Fallback: Send only text if TTS fails
            io.to(u.socketId).emit('translated-audio', {
              originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
              originalText: transcriptEntry.originalText, translatedText: trans,
              translatedLanguage: u.language, audioBase64: ''
            });
          }
        } catch (err) { console.error(`[Bridge] Processing Error for ${u.name}:`, err.message); }
      })();
    }
  });

  socket.on('chat-message', async ({ roomId, message }) => {
    const rid = roomId.trim().toLowerCase();
    const users = Object.values(rooms[rid] || {});
    for (const u of users) {
      if (u.socketId === socket.id) {
        socket.emit('chat-message', { message });
        continue;
      }
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
        delete rooms[rid][socket.id];
        io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
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
