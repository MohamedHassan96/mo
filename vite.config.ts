import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { Server } from "socket.io";

const rooms: Record<string, Record<string, any>> = {};

async function translateText(text: string, sourceLang: string, targetLang: string) {
  if (!text || sourceLang === targetLang) return text;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: `You are a strict real-time translator bridge. Translate the following text from ${sourceLang} to ${targetLang}.
RULES:
1. Return ONLY the direct translation.
2. DO NOT answer questions, do NOT act as a chatbot, do NOT say "hello" back.
3. Keep the exact original meaning.` 
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) { return text; }
}

async function generateTTS(text: string, language: string) {
  if (!text) return '';
  const voiceId = language === 'ar' ? 'cjVigY5qzO86Huf0OWal' : 'EXAVITQu4vr4xnSDxMaL';
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': 'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
  } catch (err) {}
  return '';
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
        const io = new Server(server.httpServer, { cors: { origin: "*" } });

        io.on('connection', (socket) => {
          console.log(`[Socket] Connected: ${socket.id}`);

          socket.on('join-room', (payload, callback) => {
            const { roomId, participant } = payload;
            if (!roomId || !participant) return;

            socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
            socket.join(roomId);
            
            if (!rooms[roomId]) rooms[roomId] = {};
            
            participant.socketId = socket.id;
            participant.isConnected = true;
            rooms[roomId][socket.id] = participant;

            const participants = Object.values(rooms[roomId]);
            io.to(roomId).emit('room-state', { participants });
            if (callback) callback({ status: 'ok', participants });
          });

          socket.on('chat-message', (payload, callback) => {
            const { roomId, message } = payload;
            if (!roomId || !message) return;
            socket.to(roomId).emit('chat-message', { message });
            if (callback) callback({ status: 'sent' });
          });

          socket.on('raw-transcript', async (payload, callback) => {
            const { roomId, transcriptEntry } = payload;
            if (!roomId || !transcriptEntry) return;

            if (callback) callback({ status: 'received' });
            io.to(roomId).emit('transcript-update', { transcriptEntry });

            const participants = Object.values(rooms[roomId] || {});
            for (const p of participants) {
              if (p.socketId === socket.id) continue;
              (async () => {
                let finalTranslatedText = transcriptEntry.originalText;
                if (p.language !== transcriptEntry.originalLanguage) {
                  finalTranslatedText = await translateText(transcriptEntry.originalText, transcriptEntry.originalLanguage, p.language);
                }
                const audioBase64 = await generateTTS(finalTranslatedText, p.language);
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

          socket.on('disconnect', () => {
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
      }
    }
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
