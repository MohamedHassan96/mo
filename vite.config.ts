import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { Server } from "socket.io";

// ─── Persistent state (survives Vite HMR) ─────────────────────────────────────
// We attach to globalThis so these are NOT reset when vite.config.ts is re-evaluated
declare const globalThis: any;
if (!globalThis.__talkbridge_rooms) globalThis.__talkbridge_rooms = {};

const rooms: Record<string, Record<string, any>> = globalThis.__talkbridge_rooms;

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
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

const LANG_NAMES: Record<string, string> = {
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

function cleanTranslatedText(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^["'«»]|["'«»]$/g, '')
    .replace(/^(Translation|Translated text|الترجمة|ترجمة)\s*:\s*/i, '')
    .trim();
}

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text?.trim() || sourceLang === targetLang) return text;
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = `You are a silent real-time speech translator. Your ONLY job is to translate speech.
Source language: ${srcName}
Target language: ${tgtName}

CRITICAL RULES:
- Output ONLY the translated text. Nothing else.
- Do NOT greet, explain, or comment. Just translate.
- Do NOT answer questions. Translate them as-is.
- Do NOT add quotation marks or prefixes.
- Preserve tone and meaning exactly.
- If text is already in target language, output it unchanged.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.0,
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq translation failed: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    const translated = cleanTranslatedText(data.choices?.[0]?.message?.content);
    if (!translated) throw new Error('Groq returned an empty translation');
    return translated;
  } catch (err) {
    console.error('[Translate] Fetch error:', err);
    throw err;
  }
}

async function generateTTS(text: string, language: string): Promise<string> {
  if (!text?.trim()) return '';
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }
  let voiceId: string;
  if (language === 'ar') voiceId = 'cjVigY5qzO86Huf0OWal';
  else if (language === 'fr') voiceId = 'VR6AewLTigWG4xSOukaG';
  else if (language === 'de') voiceId = 'onwK4e9ZLuTAKqWW03F9';
  else if (language === 'es') voiceId = 'MF3mGyEYCl7XYWbV9V6O';
  else voiceId = 'EXAVITQu4vr4xnSDxMaL';

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      console.log(`[TTS] ElevenLabs OK — lang=${language}, bytes=${buffer.byteLength}`);
      return Buffer.from(buffer).toString('base64');
    } else {
      const errorText = await res.text();
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${errorText}`);
    }
  } catch (err) {
    console.error('[TTS] ElevenLabs fetch error:', err);
    throw err;
  }
}

function setupApiRoutes(server: any) {
  server.middlewares.use('/api/translate', async (req: any, res: any) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    try {
      const { text, sourceLang, targetLang } = await readJsonBody(req);
      const translated = await translateText(text, sourceLang, targetLang);
      sendJson(res, 200, { ok: true, translated });
    } catch (err: any) {
      sendJson(res, 502, { ok: false, error: err?.message || 'Translation failed' });
    }
  });

  server.middlewares.use('/api/tts', async (req: any, res: any) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    try {
      const { text, language } = await readJsonBody(req);
      const audioBase64 = await generateTTS(text, language);
      sendJson(res, 200, { ok: true, audioBase64 });
    } catch (err: any) {
      sendJson(res, 502, { ok: false, error: err?.message || 'TTS failed' });
    }
  });
}

function setupSocketIO(httpServer: any) {
  // ─── Guard: one Socket.IO instance per httpServer (HMR safe) ─────────────
  // Without this, every Vite HMR cycle creates a NEW Socket.IO on the same
  // httpServer → duplicate events, reset rooms, broken host/guest state.
  const INIT_KEY = '__talkbridge_io_attached';
  if (httpServer[INIT_KEY]) {
    console.log('[Socket] Already attached — skipping re-init (HMR safe)');
    return;
  }
  httpServer[INIT_KEY] = true;
  console.log('[Socket] Socket.IO server initialized');

  const io = new Server(httpServer, {
    path: '/socket-signal',
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] + Connected: ${socket.id}`);

    // ── Join Room ──────────────────────────────────────────────────────────
    socket.on('join-room', (payload: any, callback: any) => {
      let { roomId, participant } = payload;
      if (!roomId || !participant) return;
      roomId = roomId.trim().toLowerCase();

      socket.rooms.forEach((r: string) => { if (r !== socket.id) socket.leave(r); });
      socket.join(roomId);

      if (!rooms[roomId]) rooms[roomId] = {};
      participant.socketId = socket.id;
      participant.isConnected = true;
      rooms[roomId][socket.id] = participant;

      const count = Object.keys(rooms[roomId]).length;
      console.log(`[Socket] ${participant.name} joined room "${roomId}" | lang=${participant.language} | members=${count}`);

      const participants = Object.values(rooms[roomId]);
      io.to(roomId).emit('room-state', { participants });
      if (callback) callback({ status: 'ok', participants });
    });

    // ── Chat ───────────────────────────────────────────────────────────────
    socket.on('chat-message', (payload: any, callback: any) => {
      const { roomId, message } = payload;
      if (!roomId || !message) return;
      socket.to(roomId).emit('chat-message', { message });
      if (callback) callback({ status: 'sent' });
    });

    // ── Participant State Update ───────────────────────────────────
    socket.on('update-participant', (payload: any) => {
      let { roomId, participant } = payload;
      if (!roomId || !participant) return;
      roomId = roomId.trim().toLowerCase();

      if (rooms[roomId] && rooms[roomId][socket.id]) {
        rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], ...participant };
        io.to(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
      }
    });

    // ── Transcript → Translate → TTS → Fan-out ─────────────────────
    socket.on('raw-transcript', async (payload: any, callback: any) => {
      const { roomId, transcriptEntry } = payload;
      if (!roomId || !transcriptEntry) return;
      if (callback) callback({ status: 'received' });

      // Broadcast original to everyone for instant UI update
      io.to(roomId).emit('transcript-update', { transcriptEntry });

      const roomParticipants = Object.values(rooms[roomId] || {}) as any[];
      console.log(`[Translate] "${transcriptEntry.speakerName}" (${transcriptEntry.originalLanguage}) → ${roomParticipants.length} participants`);

      for (const p of roomParticipants) {
        if (p.socketId === socket.id) continue; // skip sender

        (async () => {
          const srcLang = transcriptEntry.originalLanguage || 'ar';
          const tgtLang = p.language || 'en';
          let translated = transcriptEntry.translatedText || transcriptEntry.originalText;

          // If not already translated to the target language, or if translation is missing
          if (srcLang !== tgtLang && (!transcriptEntry.translatedLanguage || transcriptEntry.translatedLanguage !== tgtLang || translated === transcriptEntry.originalText)) {
            console.log(`[Translate] ${srcLang} → ${tgtLang}: "${transcriptEntry.originalText}"`);
            try {
              translated = await translateText(transcriptEntry.originalText, srcLang, tgtLang);
            } catch {
              // If server translation fails, still send the original text so the UI updates
              translated = transcriptEntry.originalText;
            }
            console.log(`[Translate] ✓ "${translated}"`);
          } else {
            console.log(`[Translate] Already translated or same lang: "${translated}"`);
          }

          let audioBase64 = '';
          try {
            audioBase64 = await generateTTS(translated, tgtLang);
          } catch {
            audioBase64 = '';
          }

          io.to(p.socketId).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerName: transcriptEntry.speakerName,
            originalText: transcriptEntry.originalText,
            translatedText: translated,
            translatedLanguage: tgtLang,
            audioBase64,
          });
        })();
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] - Disconnected: ${socket.id}`);
      for (const roomId in rooms) {
        if (rooms[roomId][socket.id]) {
          delete rooms[roomId][socket.id];
          const remaining = Object.keys(rooms[roomId]).length;
          if (remaining === 0) {
            delete rooms[roomId];
          } else {
            io.to(roomId).emit('room-state', { participants: Object.values(rooms[roomId]) });
          }
        }
      }
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'socket-io',
      configureServer(server) {
        setupApiRoutes(server);
        if (!server.httpServer) return;
        setupSocketIO(server.httpServer);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
