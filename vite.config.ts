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
    process.env[key] = value;
  }
}

loadLocalEnv();

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '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').trim();
const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056').trim();
const ELEVENLABS_VOICE_ID = (process.env.ELEVENLABS_VOICE_ID || 'c06fdbaa06e04b6cbe80fb460336f064').trim();

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

function hasTranslatedAudioText(
  originalText: unknown,
  translatedText: unknown,
  sourceLang: string,
  targetLang: string,
): boolean {
  const original = String(originalText || '').trim();
  const translated = String(translatedText || '').trim();
  return Boolean(
    sourceLang !== targetLang &&
    original &&
    translated &&
    translated !== original
  );
}

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readRawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function translateTextGoogleFree(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    console.log(`[Translation] Attempting Free Google Translate fallback from ${sourceLang} to ${targetLang}...`);
    const sl = sourceLang === 'ar' ? 'ar' : sourceLang;
    const tl = targetLang === 'ar' ? 'ar' : targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Free Translate HTTP error: ${response.status}`);
    
    const data = await response.json();
    if (data && data[0]) {
      const translatedParts = data[0].map((part: any) => part[0]).join('');
      console.log(`[Translation] Free Google Translate successfully translated: "${translatedParts}"`);
      return translatedParts;
    }
    throw new Error('Invalid translation response format');
  } catch (err: any) {
    console.error('[Translation] Free Google Translate failed:', err.message);
    throw err;
  }
}

async function translateTextGroq(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const srcName = LANG_NAMES[sourceLang] || sourceLang;
  const tgtName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = `Translate speech from ${srcName} to ${tgtName}. Return only the natural conversational translation, no labels, no quotes.`;

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'gemma2-9b-it', 'llama-3.2-3b-preview'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Translation] Trying Groq model ${model} for ${sourceLang} -> ${targetLang}...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0,
          max_tokens: 160,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translated = cleanTranslatedText(data.choices?.[0]?.message?.content) || text;
        if (translated && translated !== text) {
          console.log(`[Translation] Groq successfully translated with model ${model}: "${translated}"`);
          return translated;
        }
      } else {
        const errorText = await response.text();
        console.warn(`[Translation] Groq model ${model} failed:`, response.status, errorText);
      }
    } catch (err: any) {
      console.warn(`[Translation] Groq model ${model} error:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('All Groq translation models failed');
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text?.trim() || sourceLang === targetLang) return text;

  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_groq')) {
    try {
      console.log(`[Translation] Attempting Groq translation from ${sourceLang} to ${targetLang}...`);
      return await translateTextGroq(text, sourceLang, targetLang);
    } catch (err: any) {
      console.warn('[Translation] Groq translation failed:', err.message || err);
    }
  }

  // ULTIMATE RESILIENT FALLBACK: Free Google Translate API
  try {
    return await translateTextGoogleFree(text, sourceLang, targetLang);
  } catch (err: any) {
    console.error('[Translation] Ultimate fallback failed, returning original text:', err.message || err);
    return text;
  }
}

async function makeElevenLabsRequest(text: string, language: string, apiKey: string, voiceId: string): Promise<string> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
    }),
  });
  if (res.ok) {
    const buffer = await res.arrayBuffer();
    console.log(`[TTS] ElevenLabs OK — lang=${language}, bytes=${buffer.byteLength}`);
    return Buffer.from(buffer).toString('base64');
  }
  const errorText = await res.text();
  throw new Error(`ElevenLabs TTS failed: ${res.status} ${errorText}`);
}

async function generateTTS(text: string, language: string): Promise<string> {
  if (!text?.trim()) return '';
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }
  let voiceId: string;
  if (ELEVENLABS_VOICE_ID) voiceId = ELEVENLABS_VOICE_ID;
  else if (language === 'ar') voiceId = 'c06fdbaa06e04b6cbe80fb460336f064';
  else if (language === 'fr') voiceId = 'VR6AewLTigWG4xSOukaG';
  else if (language === 'de') voiceId = 'onwK4e9ZLuTAKqWW03F9';
  else if (language === 'es') voiceId = 'MF3mGyEYCl7XYWbV9V6O';
  else voiceId = 'EXAVITQu4vr4xnSDxMaL';

  try {
    return await makeElevenLabsRequest(text, language, ELEVENLABS_API_KEY, voiceId);
  } catch (err: any) {
    console.warn(`[TTS] Primary Voice ID ${voiceId} failed: ${err.message}. Trying standard fallback...`);
    
    const fallbackVoices: Record<string, string> = {
      ar: 'pNInz6obpgDQGcFmaJgB', // Adam (standard natural Arabic)
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
    
    const fallbackVoiceId = fallbackVoices[language] || 'EXAVITQu4vr4xnSDxMaL';
    if (fallbackVoiceId === voiceId) {
      console.log(`[TTS] Trying secondary generic backup: EXAVITQu4vr4xnSDxMaL`);
      return await makeElevenLabsRequest(text, language, ELEVENLABS_API_KEY, 'EXAVITQu4vr4xnSDxMaL');
    }
    
    console.log(`[TTS] Trying standard language fallback voice: ${fallbackVoiceId}`);
    return await makeElevenLabsRequest(text, language, ELEVENLABS_API_KEY, fallbackVoiceId);
  }
}

async function transcribeAudioElevenLabs(
  audioBuffer: Buffer,
  mimeType: string,
  language: string,
  apiKey: string,
): Promise<{ text: string; language: string }> {
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('mpeg') || mimeType.includes('mp3')
        ? 'mp3'
        : 'webm';
  const formData = new FormData();

  formData.append('model_id', 'scribe_v2');
  formData.append('file', new Blob([audioBuffer as any], { type: mimeType || 'audio/webm' }), `speech.${extension}`);
  if (language) formData.append('language_code', language === 'ar' ? 'ar' : language);
  formData.append('tag_audio_events', 'false');
  formData.append('timestamps_granularity', 'none');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ElevenLabs STT failed: ${response.status} ${data.detail || data.message || ''}`.trim());
  }

  return {
    text: cleanTranslatedText(data.text),
    language: data.language_code || language,
  };
}

async function transcribeAudioGroq(
  audioBuffer: Buffer,
  mimeType: string,
  language: string,
): Promise<{ text: string; language: string }> {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

  const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer as any], { type: mimeType || 'audio/webm' }), `speech.${extension}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  if (language) formData.append('language', language === 'ar' ? 'ar' : language);
  if (language === 'ar') {
    formData.append('prompt', 'الكلام بالعامية المصرية واللغة العربية الحية والعبارات الكاجوال مثل: إزيك، عامل إيه، تمام، قشطة، ماشي، يا باشا، يا صاحبي، ده، كده، إيه، هو، بص.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Groq STT failed: ${response.status} ${data.error?.message || ''}`.trim());
  }

  return {
    text: cleanTranslatedText(data.text),
    language,
  };
}

async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  language: string,
  clientElevenLabsKey = '',
): Promise<{ text: string; language: string }> {
  if (!audioBuffer.length || audioBuffer.length < 300) {
    return { text: '', language };
  }

  if (GROQ_API_KEY) {
    try {
      return await transcribeAudioGroq(audioBuffer, mimeType, language);
    } catch (err: any) {
      console.warn('[STT] Groq failed, trying ElevenLabs fallback if configured:', err?.message || err);
    }
  }

  const elevenLabsKey = clientElevenLabsKey || ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    return transcribeAudioElevenLabs(audioBuffer, mimeType, language, elevenLabsKey);
  }

  return transcribeAudioGroq(audioBuffer, mimeType, language);
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

  server.middlewares.use('/api/stt', async (req: any, res: any) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    try {
      const url = new URL(req.url || '/api/stt', 'http://localhost');
      const language = String(url.searchParams.get('language') || req.headers['x-language'] || 'ar');
      const mimeType = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
      const clientElevenLabsKey = String(req.headers['x-elevenlabs-api-key'] || '');
      const audioBuffer = await readRawBody(req);
      const result = await transcribeAudio(audioBuffer, mimeType, language, clientElevenLabsKey);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err: any) {
      sendJson(res, 502, { ok: false, error: err?.message || 'Speech-to-text failed' });
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
      const recipients = roomParticipants.filter((p) => p.socketId !== socket.id);
      if (
        recipients.length === 0 &&
        transcriptEntry.targetLanguage &&
        transcriptEntry.targetLanguage !== transcriptEntry.originalLanguage
      ) {
        recipients.push({
          socketId: socket.id,
          language: transcriptEntry.targetLanguage,
          previewOnly: true,
        });
      }
      console.log(`[Translate] "${transcriptEntry.speakerName}" (${transcriptEntry.originalLanguage}) → ${recipients.length} recipients`);

      for (const p of recipients) {
        (async () => {
          const srcLang = transcriptEntry.originalLanguage || 'ar';
          const tgtLang = p.language || 'en';
          let translated = transcriptEntry.translatedText || transcriptEntry.originalText;
          let translatedLanguage = transcriptEntry.translatedLanguage || srcLang;

          // If not already translated to the target language, or if translation is missing
          if (srcLang !== tgtLang && (!transcriptEntry.translatedLanguage || transcriptEntry.translatedLanguage !== tgtLang || translated === transcriptEntry.originalText)) {
            console.log(`[Translate] ${srcLang} → ${tgtLang}: "${transcriptEntry.originalText}"`);
            try {
              translated = await translateText(transcriptEntry.originalText, srcLang, tgtLang);
              translatedLanguage = tgtLang;
            } catch {
              // If server translation fails, still send the original text so the UI updates
              translated = transcriptEntry.originalText;
              translatedLanguage = srcLang;
            }
            console.log(`[Translate] ✓ "${translated}"`);
          } else {
            console.log(`[Translate] Already translated or same lang: "${translated}"`);
            translatedLanguage = transcriptEntry.translatedLanguage || tgtLang;
          }

          const shouldSpeakTranslatedAudio = hasTranslatedAudioText(
            transcriptEntry.originalText,
            translated,
            srcLang,
            translatedLanguage,
          );

          io.to(socket.id).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerId: transcriptEntry.speakerId,
            speakerName: transcriptEntry.speakerName,
            speakerRole: transcriptEntry.speakerRole,
            originalText: transcriptEntry.originalText,
            originalLanguage: srcLang,
            translatedText: translated,
            translatedLanguage,
            audioBase64: '',
            playAudio: false,
          });

          let audioBase64 = '';
          if (shouldSpeakTranslatedAudio && !p.previewOnly) {
            try {
              audioBase64 = await generateTTS(translated, translatedLanguage);
            } catch {
              audioBase64 = '';
            }
          }

          io.to(p.socketId).emit('translated-audio', {
            originalId: transcriptEntry.id,
            speakerId: transcriptEntry.speakerId,
            speakerName: transcriptEntry.speakerName,
            speakerRole: transcriptEntry.speakerRole,
            originalText: transcriptEntry.originalText,
            originalLanguage: srcLang,
            translatedText: translated,
            translatedLanguage,
            audioBase64,
            playAudio: shouldSpeakTranslatedAudio,
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
