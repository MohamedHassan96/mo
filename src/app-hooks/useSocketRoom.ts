import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/state/roomStore';
import type { Participant, ChatMessage, TranscriptEntry } from '@/types';

const SOCKET_SERVER_URL = '';

interface UseSocketRoomProps {
  roomId: string;
  participant: Participant;
  enabled: boolean;
  onChatMessage: (msg: ChatMessage) => void;
  onTranscriptReceived: (entry: TranscriptEntry) => void;
  onTranslatedAudio: (data: {
    originalId: string; speakerName: string; originalText: string;
    translatedText: string; translatedLanguage: string; audioBase64: string;
  }) => void;
}

export function useSocketRoom(opts: UseSocketRoomProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // BUG-FIX-9: queue transcripts when offline and flush on reconnect
  const pendingTranscriptsRef = useRef<TranscriptEntry[]>([]);

  // BUG-FIX-1: Always use the LATEST opts (not stale closure).
  // Without cbRef, reconnect join-room sends old language/name.
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

  useEffect(() => {
    if (!opts.enabled) return;

    const socket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    const joinRoom = () => {
      // BUG-FIX-1: use cbRef.current so reconnects send fresh language/name
      const { roomId, participant } = cbRef.current;
      socket.emit('join-room', {
        roomId,
        participant: { ...participant, socketId: socket.id },
      }, (response: any) => {
        if (response?.status === 'ok') {
          setIsReady(true);
          setError(null);
          useRoomStore.setState({ participants: response.participants });
        } else {
          setError('Failed to join room');
        }
      });
    };

    socket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO Server');
      joinRoom();
      // BUG-FIX-9: flush queued transcripts after reconnect
      const queued = pendingTranscriptsRef.current.splice(0);
      queued.forEach(entry => {
        socket.emit('raw-transcript', { roomId: cbRef.current.roomId, transcriptEntry: entry });
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
      setError('لا يمكن الاتصال بالخادم');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected');
      setIsReady(false);
    });

    socket.on('room-state', (data: { participants: Participant[] }) => {
      console.log('👥 Room State:', data.participants.map(p => `${p.name}(${p.language})`));
      useRoomStore.setState({ participants: data.participants });
    });

    socket.on('chat-message', (data: { message: ChatMessage }) => {
      cbRef.current.onChatMessage(data.message);
    });

    socket.on('transcript-update', (data: { transcriptEntry: TranscriptEntry }) => {
      cbRef.current.onTranscriptReceived(data.transcriptEntry);
    });

    socket.on('translated-audio', (data: any) => {
      cbRef.current.onTranslatedAudio(data);
    });

    return () => { socket.disconnect(); };
    // BUG-FIX-1: removed opts.participant.id from deps — id never changes,
    // but was causing effect to re-run and create duplicate sockets.
  }, [opts.enabled, opts.roomId]);

  // BUG-FIX-5: use socketRef.current (always fresh) not a stale closure
  const sendChatMessage = useCallback((message: ChatMessage) => {
    socketRef.current?.emit('chat-message', { roomId: cbRef.current.roomId, message });
  }, []);

  const sendTranscript = useCallback((transcriptEntry: TranscriptEntry) => {
    if (!socketRef.current?.connected) {
      // BUG-FIX-9: queue instead of drop when offline
      console.warn('[Socket] Not connected — queuing transcript for later');
      pendingTranscriptsRef.current.push(transcriptEntry);
      return;
    }
    socketRef.current.emit('raw-transcript', {
      roomId: cbRef.current.roomId,
      transcriptEntry,
    });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return { isReady, error, sendChatMessage, sendTranscript, disconnect };
}
