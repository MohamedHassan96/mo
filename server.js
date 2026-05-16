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
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'beaa621826694aca94541211f9d66d29';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large transcripts/audio if needed

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'talkbridge',
    socketPath: '/socket-signal',
    groqConfigured: Boolean(GROQ_API_KEY),
    geminiConfigured: Boolean(GEMINI_API_KEY),
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
// Room Config: Record<roomId, { geminiApiKey: string, elevenLabsApiKey: string }>
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

// Helper: Translation API (Gemini)
async function translateText(text, sourceLang, targetLang, customApiKey = '') {
  if (!text || sourceLang === targetLang) return text;
  
  const apiKey = customApiKey || GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not found on server or room config');
    if (GROQ_API_KEY) return translateTextGroq(text, sourceLang, targetLang);
    return text;
  }

  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const systemPrompt = `You are a professional real-time SLANG-AWARE conversational translator bridge.
Translate from ${srcName} to ${tgtName}.

RULES:
1. Return ONLY the direct translation. No explanations.
2. Maintain the EXACT VIBE and SLANG of the speaker.
3. FOR ARABIC (Target): Use deep Egyptian/White Arabic. Use "إزيك", "عامل إيه", "قشطة", "فل", "ماشي", "يا صاحبي", "يا باشا". AVOID "كيف حالك", "حسناً".
4. FOR ENGLISH (Target): Use casual, natural slang. Use "What's up", "Bro", "Cool", "I'm down", "Gotcha", "No worries".

EXAMPLES:
- "What's up bro" -> "إيه الكلام يا صاحبي؟"
- "That's legit" -> "ده على وضعه والله"
- "I'm down for that" -> "قشطة أنا معاك"
- "فكك مني" -> "Get off my back"
- "منور يا وحش" -> "Good to see you, legend"`;

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
      throw new Error(`Gemini translation failed: ${response.status}`);
    }

    const data = await response.json();
    const translated = cleanTranslatedText(data.candidates?.[0]?.content?.parts?.[0]?.text);
    
    if (!translated || translated === text) {
      throw new Error('Gemini returned empty or invalid translation');
    }
    
    return translated;
  } catch (err) {
    console.error('Gemini Translation error:', err.message);
    // Fallback to Groq if available
    if (GROQ_API_KEY) {
      return translateTextGroq(text, sourceLang, targetLang);
    }
    return text;
  }
}

async function translateTextGroq(text, sourceLang, targetLang) {
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = `You are a strict real-time translator bridge. Translate from ${srcName} to ${tgtName}. Rules: Return ONLY direct translation, no labels, no quotes.`;

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
      }),
    });
    const data = await response.json();
    return cleanTranslatedText(data.choices?.[0]?.message?.content) || text;
  } catch (err) {
    console.error('Groq Translation error:', err);
    return text;
  }
}

const ELEVENLABS_VOICES = {
  ar: 'cjVigY5qzO86Huf0OWal', // Egyptian Arabic
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

// Helper: TTS API
async function generateTTS(text, language, customApiKey = '') {
  if (!text) return '';
  const apiKey = customApiKey || ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API Key is not configured on server or room');
  }
  
  const voiceId = ELEVENLABS_VOICES[language] || ELEVENLABS_VOICES.en;
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { 
          stability: 0.5, 
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true
        },
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
    const { text, sourceLang, targetLang, apiKey } = req.body;
    const translated = await translateText(text, sourceLang, targetLang, apiKey);
    res.json({ ok: true, translated });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'Translation failed' });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text, language, apiKey } = req.body;
    const audioBase64 = await generateTTS(text, language, apiKey);
    res.json({ ok: true, audioBase64 });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'TTS failed' });
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

  // Room Config Update
  socket.on('update-room-config', (payload) => {
    const { roomId, config } = payload;
    if (!roomId || !config) return;
    const nid = roomId.trim().toLowerCase();
    roomConfigs[nid] = { ...roomConfigs[nid], ...config };
    console.log(`[Socket] Room ${nid} config updated`);
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
    const rConfig = roomConfigs[roomId] || {};
    
    // Fan-out Translations
    for (const p of participants) {
      if (p.socketId === socket.id) continue; // Skip sender

      (async () => {
        const srcLang = transcriptEntry.originalLanguage || 'ar';
        const tgtLang = p.language || 'en';
        let finalTranslatedText = transcriptEntry.translatedText || transcriptEntry.originalText;
        
        // Translate if languages differ AND (not already translated OR translated for different language)
        const needsTranslation = srcLang !== tgtLang && (
          !transcriptEntry.translatedLanguage || 
          transcriptEntry.translatedLanguage !== tgtLang || 
          finalTranslatedText === transcriptEntry.originalText
        );

        if (needsTranslation) {
          try {
            console.log(`[Server] 🌐 Translating for ${p.name}: ${srcLang} -> ${tgtLang}`);
            finalTranslatedText = await translateText(
              transcriptEntry.originalText, 
              srcLang, 
              tgtLang,
              rConfig.geminiApiKey
            );
          } catch (err) {
            console.warn(`[Server] ❌ Translation failed:`, err.message);
            finalTranslatedText = transcriptEntry.originalText;
          }
        }

        // Generate Audio Base64 (The "Correct Workflow" - Server Side TTS)
        let audioBase64 = '';
        try {
          const ttsKey = rConfig.elevenLabsApiKey || ELEVENLABS_API_KEY;
          if (ttsKey && finalTranslatedText) {
            console.log(`[Server] 🔊 Generating ElevenLabs TTS for ${p.name} (${p.language})`);
            audioBase64 = await generateTTS(
              finalTranslatedText, 
              p.language,
              ttsKey
            );
          }
        } catch (err) {
          console.warn(`[Server] ❌ TTS generation failed:`, err.message);
          audioBase64 = '';
        }

        // Send direct to specific participant's socket
        if (finalTranslatedText || audioBase64) {
          io.to(p.socketId).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerName: transcriptEntry.speakerName,
            originalText: transcriptEntry.originalText,
            translatedText: finalTranslatedText,
            translatedLanguage: p.language,
            audioBase64
          });
        }
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
          delete roomConfigs[roomId];
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
