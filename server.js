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
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large transcripts/audio if needed

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'talkbridge',
    socketPath: '/socket-signal',
    groqConfigured: Boolean(GROQ_API_KEY),
    elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY)
  });
});

// Serve Vite's static build files (Frontend)
app.use(express.static(path.join(__dirname, 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Debug: Log all connection attempts
io.engine.on("connection_error", (err) => {
  console.log(`[Socket.IO Engine Error] Code: ${err.code}, Message: ${err.message}, Context:`, err.context);
});

// Canonical Room State: Record<roomId, Record<socketId, Participant>>
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

// Helper: Translation API
async function translateText(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = `You are a strict real-time translator bridge.
Source language: ${srcName}
Target language: ${tgtName}

RULES:
1. Return ONLY the direct translation.
2. Do NOT answer questions. Translate questions as questions.
3. Do NOT greet, explain, apologize, or comment.
4. Do NOT add labels, prefixes, quotation marks, markdown, or alternatives.
5. Preserve the original meaning, tone, names, numbers, and punctuation.
6. If the input is already in the target language, return it unchanged.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq translation failed: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const translated = cleanTranslatedText(data.choices?.[0]?.message?.content);
    if (!translated) throw new Error('Groq returned an empty translation');
    return translated;
  } catch (err) {
    console.error('Translation error:', err);
    throw err;
  }
}

// Helper: TTS API
async function generateTTS(text, language) {
  if (!text) return '';
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }
  const voiceId = process.env.ELEVENLABS_VOICE_ID || (language === 'ar' ? 'cjVigY5qzO86Huf0OWal' : 'EXAVITQu4vr4xnSDxMaL');
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${errorText}`);
  } catch (err) {
    console.error('TTS error:', err);
    throw err;
  }
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

    console.log(`[Socket] ${participant.name} joined ${roomId}`);

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

  // 3. Translated Text & Audio Delivery Pattern
  socket.on('raw-transcript', async (payload, callback) => {
    let { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;
    roomId = roomId.trim().toLowerCase();

    if (callback) callback({ status: 'received' });

    // Broadcast original text to everyone for instant UI update
    io.in(roomId).emit('transcript-update', { transcriptEntry });

    const participants = Object.values(rooms[roomId] || {});
    
    // Fan-out Translations
    for (const p of participants) {
      if (p.socketId === socket.id) continue; // Skip sender

      (async () => {
        let finalTranslatedText = transcriptEntry.originalText;
        
        // Translate if languages differ
        if (p.language !== transcriptEntry.originalLanguage) {
          try {
            finalTranslatedText = await translateText(
              transcriptEntry.originalText, 
              transcriptEntry.originalLanguage, 
              p.language
            );
          } catch {
            return;
          }
        }

        // Generate Audio Base64
        let audioBase64 = '';
        try {
          audioBase64 = await generateTTS(finalTranslatedText, p.language);
        } catch {
          audioBase64 = '';
        }

        // Send direct to specific participant's socket
        io.to(p.socketId).emit('translated-audio', {
          originalId: transcriptEntry.id,
          speakerName: transcriptEntry.speakerName,
          originalText: transcriptEntry.originalText,
          translatedText: finalTranslatedText,
          translatedLanguage: p.language,
          audioBase64
        });
      })();
    }
  });

  // 4. Disconnect & Resync
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      if (rooms[roomId][socket.id]) {
        delete rooms[roomId][socket.id];
        if (Object.keys(rooms[roomId]).length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
        }
      }
    }
  });
});

// Catch-all to support React Router SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Socket.IO Backend & Frontend] Running on http://0.0.0.0:${PORT}`);
});

// Low-level debugging
httpServer.on('upgrade', (req, socket, head) => {
  console.log(`[HTTP Upgrade Attempt] URL: ${req.url}, Headers:`, req.headers);
});

