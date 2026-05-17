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

console.log(`[TalkBridge] Config: Groq=${Boolean(GROQ_API_KEY)}, Gemini=${Boolean(GEMINI_API_KEY)}, ElevenLabs=${Boolean(ELEVENLABS_API_KEY)}`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  if (req.url !== '/api/health') console.log(`[TalkBridge] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'talkbridge-pro',
    timestamp: Date.now(),
    keys: {
      groq: Boolean(GROQ_API_KEY),
      gemini: Boolean(GEMINI_API_KEY),
      elevenLabs: Boolean(ELEVENLABS_API_KEY),
      voiceId: ELEVENLABS_VOICE_ID || 'default'
    }
  });
});

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

console.log(`[TalkBridge] Server directory: ${__dirname}`);
console.log(`[TalkBridge] Looking for dist at: ${distPath}`);
console.log(`[TalkBridge] Index.html exists: ${fs.existsSync(indexPath)}`);

app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket-signal',
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 30000,
  pingInterval: 10000
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
  return String(value || '').trim().replace(/^["'«»]|["'«»]$/g, '').replace(/^(Translation|Translated text|الترجمة|ترجمة)\s*:\s*/i, '').trim();
}

async function translateText(text, sourceLang, targetLang, customApiKey = '') {
  if (!text || sourceLang === targetLang) return text;
  
  // Try Groq First
  if (GROQ_API_KEY) {
    try {
      console.log(`[Translate] Groq: ${sourceLang} -> ${targetLang}`);
      const srcName = LANG_NAMES[sourceLang] || sourceLang;
      const tgtName = LANG_NAMES[targetLang] || targetLang;
      const systemPrompt = `You are a professional real-time translator. Translate from ${srcName} to ${tgtName}. Return ONLY the translation. Maintain casual/slang tone.`;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }], temperature: 0 }),
      });
      if (response.ok) {
        const data = await response.json();
        const result = cleanTranslatedText(data.choices?.[0]?.message?.content);
        if (result) {
          console.log(`[Translate] Groq Success: "${result}"`);
          return result;
        }
      } else {
        console.warn(`[Translate] Groq failed: ${response.status}`);
      }
    } catch (err) { console.warn('[Translate] Groq error:', err.message); }
  }

  // Try Gemini
  const apiKey = customApiKey || GEMINI_API_KEY;
  if (apiKey) {
    try {
      console.log(`[Translate] Gemini: ${sourceLang} -> ${targetLang}`);
      const srcName = LANG_NAMES[sourceLang] || sourceLang;
      const tgtName = LANG_NAMES[targetLang] || targetLang;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Professional real-time translator. ${srcName} to ${tgtName}. NO explanations. FOR ARABIC: Use Egyptian slang.\n\nText: ${text}` }] }], generationConfig: { temperature: 0, maxOutputTokens: 500 } })
      });
      if (response.ok) {
        const data = await response.json();
        const result = cleanTranslatedText(data.candidates?.[0]?.content?.parts?.[0]?.text);
        if (result) {
          console.log(`[Translate] Gemini Success: "${result}"`);
          return result;
        }
      } else {
        console.warn(`[Translate] Gemini failed: ${response.status}`);
      }
    } catch (err) { console.warn('[Translate] Gemini error:', err.message); }
  }

  console.log(`[Translate] Fallback to original text`);
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
  if (!apiKey) {
    console.log(`[TTS] No API key available for TTS`);
    return '';
  }
  const voiceId = ELEVENLABS_VOICE_ID || ELEVENLABS_VOICES[language] || ELEVENLABS_VOICES.en;
  try {
    console.log(`[TTS] Requesting ElevenLabs: lang=${language}, voice=${voiceId}`);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
    });
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log(`[TTS] Success: ${buffer.byteLength} bytes`);
      return Buffer.from(buffer).toString('base64');
    } else {
      const errText = await response.text();
      console.warn(`[TTS] ElevenLabs failed: ${response.status} - ${errText}`);
    }
  } catch (err) { console.error('[TTS] ElevenLabs error:', err.message); }
  return '';
}

io.on('connection', (socket) => {
  console.log(`[Socket] + Connected: ${socket.id}`);

  socket.on('join-room', (payload, callback) => {
    let { roomId, participant } = payload;
    if (!roomId || !participant) return;
    roomId = roomId.trim().toLowerCase();
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = {};
    participant.socketId = socket.id;
    rooms[roomId][socket.id] = participant;
    const participants = Object.values(rooms[roomId]);
    io.in(roomId).emit('room-state', { participants });
    if (callback) callback({ status: 'ok', participants });
  });

  socket.on('update-room-config', (payload) => {
    const { roomId, config } = payload;
    if (!roomId || !config) return;
    const nid = roomId.trim().toLowerCase();
    console.log(`[Socket] Config update for ${nid}: Gemini=${Boolean(config.geminiApiKey)}, ElevenLabs=${Boolean(config.elevenLabsApiKey)}`);
    roomConfigs[nid] = { ...roomConfigs[nid], ...config };
  });

  socket.on('chat-message', (payload) => {
    let { roomId, message } = payload;
    if (!roomId || !message) return;
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

  socket.on('raw-transcript', async (payload) => {
    let { roomId, transcriptEntry } = payload;
    if (!roomId || !transcriptEntry) return;
    roomId = roomId.trim().toLowerCase();
    
    console.log(`[Socket] Transcript from ${transcriptEntry.speakerName} (${transcriptEntry.originalLanguage}): "${transcriptEntry.originalText}"`);
    
    io.in(roomId).emit('transcript-update', { transcriptEntry });
    
    const pList = Object.values(rooms[roomId] || {});
    const rConfig = roomConfigs[roomId] || {};
    
    for (const p of pList) {
      if (p.socketId === socket.id) continue;
      
      (async () => {
        const src = transcriptEntry.originalLanguage || 'ar';
        const tgt = p.language || 'en';
        console.log(`[Socket] Processing for ${p.name} (${tgt})`);
        
        try {
          let translated = await translateText(transcriptEntry.originalText, src, tgt, rConfig.geminiApiKey);
          let audio = await generateTTS(translated, tgt, rConfig.elevenLabsApiKey);
          
          if (audio) {
            console.log(`[Socket] Sending audio to ${p.name}`);
            io.to(p.socketId).emit('translated-audio', {
              originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
              originalText: transcriptEntry.originalText, translatedText: translated,
              translatedLanguage: tgt, audioBase64: audio
            });
          } else {
            console.warn(`[Socket] Failed to generate audio for ${p.name}`);
            // Still send the translation so they can see it
            io.to(p.socketId).emit('translated-audio', {
              originalId: transcriptEntry.id, speakerName: transcriptEntry.speakerName,
              originalText: transcriptEntry.originalText, translatedText: translated,
              translatedLanguage: tgt, audioBase64: ''
            });
          }
        } catch (e) {
          console.error(`[Socket] Error processing for ${p.name}:`, e.message);
        }
      })();
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] - Disconnected: ${socket.id}`);
    for (const rid in rooms) {
      if (rooms[rid][socket.id]) {
        delete rooms[rid][socket.id];
        if (Object.keys(rooms[rid]).length === 0) {
          delete rooms[rid]; delete roomConfigs[rid];
        } else {
          io.to(rid).emit('room-state', { participants: Object.values(rooms[rid]) });
        }
      }
    }
  });
});

app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`[TalkBridge] ERROR: index.html not found at ${indexPath}`);
    res.status(404).send(`
      <h1>Build not found</h1>
      <p>The server is running but the frontend build is missing.</p>
      <hr/>
      <p>Please check your Railway build logs to see if <code>npm run build</code> succeeded.</p>
    `);
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`[TalkBridge Pro] API running on port ${PORT}`));
