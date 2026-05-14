/**
 * useRoomChannel — WebSocket channel للرسائل والمشاركين والنصوص
 * يستخدم WebSocket server مدمج في Vite بدلاً من PeerJS DataConnection
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, Participant, TranscriptEntry } from '@/types';

type WsMessage =
  | { type: 'chat'; payload: ChatMessage; _from?: string }
  | { type: 'participant-update'; payload: Participant; _from?: string }
  | { type: 'participant-list'; payload: Participant[]; _from?: string }
  | { type: 'transcript'; payload: TranscriptEntry; _from?: string }
  | { type: '_members'; members: string[] }
  | { type: '_joined'; id: string }
  | { type: '_left'; id: string };

interface Options {
  roomId: string;
  myId: string;
  onChatMessage: (msg: ChatMessage) => void;
  onParticipantUpdate: (p: Participant) => void;
  onParticipantLeft: (id: string) => void;
  onMembersChange: (count: number) => void;
  onTranscriptReceived?: (t: TranscriptEntry) => void;
}

// كشف URL الـ WebSocket
function getWsUrl(roomId: string, myId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws-signal?room=${encodeURIComponent(roomId)}&id=${encodeURIComponent(myId)}`;
}

export function useRoomChannel(opts: Options) {
  const cb = useRef(opts);
  useEffect(() => { cb.current = opts; });

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    const url = getWsUrl(opts.roomId, opts.myId);
    console.log(`[WS] Connecting to: ${url}`);

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as WsMessage;
          console.log(`[WS] ← ${msg.type}`);

          switch (msg.type) {
            case '_members':
              setMemberCount(msg.members.length + 1); // +1 for me
              cb.current.onMembersChange(msg.members.length + 1);
              break;
            case '_joined':
              setMemberCount(prev => {
                const n = prev + 1;
                cb.current.onMembersChange(n);
                return n;
              });
              break;
            case '_left':
              setMemberCount(prev => {
                const n = Math.max(1, prev - 1);
                cb.current.onMembersChange(n);
                return n;
              });
              cb.current.onParticipantLeft(msg.id);
              break;
            case 'chat':
              cb.current.onChatMessage(msg.payload);
              break;
            case 'participant-update':
              cb.current.onParticipantUpdate(msg.payload);
              break;
            case 'participant-list':
              msg.payload.forEach(p => cb.current.onParticipantUpdate(p));
              break;
            case 'transcript':
              cb.current.onTranscriptReceived?.(msg.payload);
              break;
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected — reconnecting in 2s');
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (e) => console.error('[WS] Error:', e);
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId, opts.myId]);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Cannot send — not connected');
    }
  }, []);

  const sendChatMessage = useCallback((m: ChatMessage) =>
    send({ type: 'chat', payload: m }), [send]);

  const sendParticipantUpdate = useCallback((p: Participant) =>
    send({ type: 'participant-update', payload: p }), [send]);

  const sendParticipantList = useCallback((list: Participant[]) =>
    send({ type: 'participant-list', payload: list }), [send]);

  const sendTranscript = useCallback((t: TranscriptEntry) =>
    send({ type: 'transcript', payload: t }), [send]);

  return {
    connected,
    memberCount,
    sendChatMessage,
    sendParticipantUpdate,
    sendParticipantList,
    sendTranscript,
  };
}
