import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/state/roomStore';
import type { Participant, ChatMessage, TranscriptEntry } from '@/types';

// Connect to the same origin (Vite dev server handles the Socket.IO plugin)
const SOCKET_SERVER_URL = '';

interface UseSocketRoomProps {
  roomId: string;
  participant: Participant;
  enabled: boolean;
  onChatMessage: (msg: ChatMessage) => void;
  onTranscriptReceived: (entry: TranscriptEntry) => void;
  onTranslatedAudio: (data: {
    originalId: string;
    speakerName: string;
    originalText: string;
    translatedText: string;
    translatedLanguage: string;
    audioBase64: string;
  }) => void;
}

export function useSocketRoom(opts: UseSocketRoomProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const { participants } = useRoomStore();

  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; }, [opts]);

  useEffect(() => {
    if (!opts.enabled) return;

    const socket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO Server');
      
      // Join Room
      socket.emit('join-room', { 
        roomId: opts.roomId, 
        participant: opts.participant 
      }, (response: any) => {
        if (response?.status === 'ok') {
          setIsReady(true);
          setError(null);
          useRoomStore.setState({ participants: response.participants });
        } else {
          setError('Failed to join room');
        }
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
      setError('لا يمكن الاتصال بالخادم');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.IO Server');
      setIsReady(false);
    });

    // Sync Canonical Room State
    socket.on('room-state', (data: { participants: Participant[] }) => {
      console.log('👥 Room State Sync:', data.participants);
      useRoomStore.setState({ participants: data.participants });
    });

    // Chat Message
    socket.on('chat-message', (data: { message: ChatMessage }) => {
      cbRef.current.onChatMessage(data.message);
    });

    // Transcript Update (Original Text)
    socket.on('transcript-update', (data: { transcriptEntry: TranscriptEntry }) => {
      cbRef.current.onTranscriptReceived(data.transcriptEntry);
    });

    // Translated Audio Received
    socket.on('translated-audio', (data: any) => {
      cbRef.current.onTranslatedAudio(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [opts.enabled, opts.roomId, opts.participant.id]);

  const sendChatMessage = useCallback((message: ChatMessage) => {
    socketRef.current?.emit('chat-message', { roomId: opts.roomId, message });
  }, [opts.roomId]);

  const sendTranscript = useCallback((transcriptEntry: TranscriptEntry) => {
    socketRef.current?.emit('raw-transcript', { roomId: opts.roomId, transcriptEntry });
  }, [opts.roomId]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return {
    isReady,
    error,
    sendChatMessage,
    sendTranscript,
    disconnect,
  };
}
