import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { Server } from "socket.io";

// ─── Persistent state (survives Vite HMR) ─────────────────────────────────────
// We attach to globalThis so these are NOT reset when vite.config.ts is re-evaluated
declare const globalThis: any;
if (!globalThis.__talkbridge_rooms) globalThis.__talkbridge_rooms = {};

const rooms: Record<string, Record<string, any>> = globalThis.__talkbridge_rooms;

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', en: 'English', fr: 'French', de: 'German',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', tr: 'Turkish',
  nl: 'Dutch', pl: 'Polish', hi: 'Hindi', fa: 'Persian',
};

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text?.trim() || sourceLang === targetLang) return text;
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
        'Authorization': 'Bearer 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',
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
      console.error('[Translate] Groq error:', res.status, await res.text());
      return text;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error('[Translate] Fetch error:', err);
    return text;
  }
}

async function generateTTS(text: string, language: string): Promise<string> {
  if (!text?.trim()) return '';
  let voiceId: string;
  if (language === 'ar')      voiceId = 'cjVigY5qzO86Huf0OWal';
  else if (language === 'fr') voiceId = 'VR6AewLTigWG4xSOukaG';
  else if (language === 'de') voiceId = 'onwK4e9ZLuTAKqWW03F9';
  else if (language === 'es') voiceId = 'MF3mGyEYCl7XYWbV9V6O';
  else                        voiceId = 'EXAVITQu4vr4xnSDxMaL';

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': 'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126',
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
      console.error(`[TTS] ElevenLabs error ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error('[TTS] ElevenLabs fetch error:', err);
  }
  return '';
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
    path: '/api/socket.io',
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] + Connected: ${socket.id}`);

    // ── Join Room ──────────────────────────────────────────────────────────
    socket.on('join-room', (payload: any, callback: any) => {
      const { roomId, participant } = payload;
      if (!roomId || !participant) return;

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

    // ── Transcript → Translate → TTS → Fan-out ─────────────────────────────
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
          let translated = transcriptEntry.originalText;

          if (srcLang !== tgtLang) {
            console.log(`[Translate] ${srcLang} → ${tgtLang}: "${transcriptEntry.originalText}"`);
            translated = await translateText(transcriptEntry.originalText, srcLang, tgtLang);
            console.log(`[Translate] ✓ "${translated}"`);
          } else {
            console.log(`[Translate] Same lang (${srcLang}) — no translation`);
          }

          const audioBase64 = await generateTTS(translated, tgtLang);

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
    viteSingleFile(),
    {
      name: 'socket-io',
      configureServer(server) {
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
});
