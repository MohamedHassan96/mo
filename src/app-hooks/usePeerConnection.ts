import { useCallback, useEffect, useRef, useState } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { useRoomStore } from '@/state/roomStore';
import type { ChatMessage, Participant, TranscriptEntry } from '@/types';

type Msg =
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'participant-update'; payload: Participant }
  | { type: 'participant-list'; payload: Participant[] }
  | { type: 'transcript'; payload: TranscriptEntry };

interface Options {
  roomId: string;
  isHost: boolean;
  onRemoteStream: (stream: MediaStream, peerId: string) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onParticipantUpdate: (p: Participant) => void;
  onParticipantLeft: (peerId: string) => void;
  onConnectionChange: (connected: boolean, count: number) => void;
  onPeerConnected?: (peerId: string) => void;
  onTranscriptReceived?: (t: TranscriptEntry) => void;
  enabled?: boolean;
}

interface Conn {
  mc: MediaConnection | null;
}

export function usePeerConnection(opts: Options) {
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; });

  const isHostRef = useRef(opts.isHost);
  useEffect(() => { isHostRef.current = opts.isHost; });

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  const connsRef = useRef<Map<string, Conn>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<InstanceType<typeof Peer> | null>(null);

  const { setRemoteStream } = useRoomStore();

  const refreshPeers = useCallback(() => {
    const peers = Array.from(connsRef.current.entries())
      .filter(([_, c]) => c.mc)
      .map(([pid, _]) => pid);
    setConnectedPeers(peers);
    cbRef.current.onConnectionChange(peers.length > 0, peers.length);
  }, []);

  useEffect(() => {
    if (opts.enabled === false) return;

    const peerId = opts.isHost
      ? `talkbridge-${opts.roomId}`.toLowerCase()
      : `talkbridge-${opts.roomId}-${Date.now().toString(36)}`.toLowerCase();

    console.log(`🔗 Peer: ${peerId} (${opts.isHost ? 'HOST' : 'GUEST'})`);

    const peer = new Peer(peerId, { debug: 1 });
    peerRef.current = peer;

    const readyTimer = setTimeout(() => { setIsReady(true); }, 5000);

    // DataConnection is handled by Socket.IO now, we only need PeerJS for MediaStream

    peer.on('call', (call) => {
      const pid = call.peer;
      console.log(`📞 Incoming call from: ${pid}`);

      const stream = localStreamRef.current;
      if (stream) call.answer(stream);
      else {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(s => { localStreamRef.current = s; call.answer(s); })
          .catch(() => call.answer());
      }

      const upsert = () => {
        const existing = connsRef.current.get(pid);
        if (existing) { existing.mc = call; }
        else connsRef.current.set(pid, { mc: call });
      };
      upsert();

      call.on('stream', (remoteStream) => {
        console.log(`🎥 Stream from: ${pid}`);
        cbRef.current.onRemoteStream(remoteStream, pid);
        setRemoteStream(remoteStream);
        refreshPeers();
      });

      call.on('error', (e) => console.error(`❌ Call error (${pid}):`, e));
      call.on('close', () => {
        connsRef.current.delete(pid);
        cbRef.current.onParticipantLeft(pid);
        refreshPeers();
      });
    });

    peer.on('open', (id) => {
      console.log('✅ Peer open:', id);
      clearTimeout(readyTimer);
      setIsReady(true);
      setError(null);
    });

    peer.on('error', (err) => {
      console.error('❌ Peer error:', err.type);
      clearTimeout(readyTimer);
      setIsReady(true);
      if (err.type === 'unavailable-id') setError(opts.isHost ? 'الغرفة مستخدمة بالفعل' : null);
      else if (err.type === 'peer-unavailable') setError('المضيف غير متصل');
    });

    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });

    peerRef.current = peer;

    return () => {
      clearTimeout(readyTimer);
      connsRef.current.forEach(c => { c.mc?.close(); });
      connsRef.current.clear();
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId, opts.isHost, opts.enabled]);

  const connectToHost = useCallback(async (stream: MediaStream) => {
    localStreamRef.current = stream;
    const peer = peerRef.current;
    if (!peer) return false;

    if (!peer.open) {
      await new Promise<void>((res) => {
        peer.once('open', () => res());
        setTimeout(res, 4000);
      });
    }

    const hostId = `talkbridge-${opts.roomId}`.toLowerCase();
    console.log(`🔌 Connecting to host: ${hostId}`);

    try {
      const call = peer.call(hostId, stream);
      connsRef.current.set(hostId, { mc: call });

      call.on('stream', (remoteStream) => {
        console.log('🎥 Guest got host stream');
        cbRef.current.onRemoteStream(remoteStream, hostId);
        setRemoteStream(remoteStream);
      });

      call.on('error', (e) => console.error('❌ Guest call error:', e));
      call.on('close', () => {
        connsRef.current.delete(hostId);
        refreshPeers();
      });

      return true;
    } catch (e) {
      console.error('connectToHost error:', e);
      setError('فشل الاتصال');
      return false;
    }
  }, [opts.roomId, refreshPeers]);

  const setLocalStream = useCallback((s: MediaStream) => { localStreamRef.current = s; }, []);

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    connsRef.current.forEach(c => {
      if (c.mc && track && c.mc.peerConnection) {
        const sender = c.mc.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(track).catch(console.error);
      }
    });
  }, []);

  const disconnect = useCallback(() => {
    connsRef.current.forEach(c => { c.mc?.close(); });
    connsRef.current.clear();
    refreshPeers();
  }, [refreshPeers]);

  return {
    isReady, error, connectedPeers,
    myPeerId: peerRef.current?.id ?? '',
    connectToHost, setLocalStream,
    replaceVideoTrack, disconnect,
  };
}
