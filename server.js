import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve Vite's static build files (Frontend)
app.use(express.static(path.join(__dirname, 'dist')));

// Debug: Catch if socket requests fall through to Express
app.use('/api/socket.io', (req, res, next) => {
  console.error('[Express] ERROR: /api/socket.io request fell through to Express! Engine.IO did not intercept it. Headers:', req.headers);
  res.status(500).json({ error: 'Socket.IO failed to intercept request' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/api/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Debug: Log all connection attempts
io.engine.on("connection_error", (err) => {
  console.log(`[Socket.IO Engine Error] Code: ${err.code}, Message: ${err.message}, Context:`, err.context);
});

// Canonical Room State: Record<roomId, Record<socketId, Participant>>
const rooms = {};

// Helper: Translation API
async function translateText(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;
  
  const systemPrompt = `You are a strict real-time translator bridge. Translate the following text from ${sourceLang} to ${targetLang}.
RULES:
1. Return ONLY the direct translation.
2. DO NOT answer questions, do NOT act as a chatbot, do NOT say "hello" back.
3. Keep the exact original meaning.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return text;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}

// Helper: TTS API
async function generateTTS(text, language) {
  if (!text) return '';
  const voiceId = language === 'ar' ? 'cjVigY5qzO86Huf0OWal' : 'EXAVITQu4vr4xnSDxMaL';
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': 'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126',
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
  } catch (err) {
    console.error('TTS error:', err);
  }
  return '';
}

io.on('connection', (socket) => {
  console.log(`[Socket] +++ New connection request: ${socket.id} from ${socket.handshake.address}`);

  // 1. Join Room & Canonical State Sync
  socket.on('join-room', (payload, callback) => {
    const { roomId, participant } = payload;
    if (!roomId || !participant) return;

    // Leave old rooms
    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(roomId);
    
    if (!rooms[roomId]) rooms[roomId] = {};
    
    participant.socketId = socket.id;
    participant.isConnected = true;
    rooms[roomId][socket.id] = participant;

    console.log(`[Socket] ${participant.name} joined ${roomId}`);

    const participants = Object.values(rooms[roomId]);
    io.to(roomId).emit('room-state', { participants });

    if (callback) callback({ status: 'ok', participants });
  });

  // 2. Chat with Ack
  socket.on('chat-message', (payload, callback) => {
    const { roomId, message } = payload;
    if (!roomId || !message) return;
    
    // Broadcast to others in the room
    socket.to(roomId).emit('chat-message', { message });
    if (callback) callback({ status: 'sent' });
  });

  // 3. Translated Text & Audio Delivery Pattern
  socket.on('raw-transcript', async (payload, callback) => {
    const { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;

    if (callback) callback({ status: 'received' });

    // Broadcast original text to everyone for instant UI update
    io.to(roomId).emit('transcript-update', { transcriptEntry });

    const participants = Object.values(rooms[roomId] || {});
    
    // Fan-out Translations
    for (const p of participants) {
      if (p.socketId === socket.id) continue; // Skip sender

      (async () => {
        let finalTranslatedText = transcriptEntry.originalText;
        
        // Translate if languages differ
        if (p.language !== transcriptEntry.originalLanguage) {
          finalTranslatedText = await translateText(
            transcriptEntry.originalText, 
            transcriptEntry.originalLanguage, 
            p.language
          );
        }

        // Generate Audio Base64
        const audioBase64 = await generateTTS(finalTranslatedText, p.language);

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
