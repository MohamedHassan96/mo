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
  myId: string;
  hostId?: string;
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

    const peerId = opts.myId;

    console.log(`🔗 Peer: ${peerId} (${opts.isHost ? 'HOST' : 'GUEST'})`);

    const peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      }
    });
    peerRef.current = peer;

    const readyTimer = setTimeout(() => { setIsReady(true); }, 5000);

    // DataConnection is handled by Socket.IO now, we only need PeerJS for MediaStream

    peer.on('call', (call) => {
      const pid = call.peer;
      console.log(`📞 Incoming call from: ${pid}`);

      // IMPORTANT: Always reuse the existing local stream.
      // Calling getUserMedia() here causes Web Speech Recognition to abort
      // because Chrome sees two concurrent mic requests and kills the STT session.
      const stream = localStreamRef.current;
      if (stream) {
        call.answer(stream);
      } else {
        // Only fallback if we truly have no stream yet (shouldn't happen in normal flow)
        call.answer(); // answer without stream to avoid mic conflict
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
      else if (err.type === 'peer-unavailable') {
        console.warn('[Peer] Target peer not found, will retry if Socket.IO syncs it again.');
        // Don't set error yet, it might be a temporary sync delay
      }
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

    const targetHostId = opts.hostId || opts.roomId;
    console.log(`🔌 Connecting directly to Host Peer: ${targetHostId}`);

    try {
      const call = peer.call(targetHostId, stream);
      connsRef.current.set(targetHostId, { mc: call });

      call.on('stream', (remoteStream) => {
        console.log('🎥 Guest got host stream');
        cbRef.current.onRemoteStream(remoteStream, targetHostId);
        setRemoteStream(remoteStream);
      });

      call.on('error', (e) => console.error('❌ Guest call error:', e));
      call.on('close', () => {
        connsRef.current.delete(targetHostId);
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
