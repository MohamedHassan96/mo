import { useCallback, useEffect, useRef, useState } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { useRoomStore } from '@/state/roomStore';
import type { ChatMessage, Participant, TranscriptEntry } from '@/types';

type Msg =
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'participant-update'; payload: Participant }
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
  sc: MediaConnection | null;
  dc: DataConnection | null;
}

export function usePeerConnection(opts: Options) {
  const cbRef = useRef(opts);
  useEffect(() => { cbRef.current = opts; });

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  const connsRef = useRef<Map<string, Conn>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<InstanceType<typeof Peer> | null>(null);

  const { setRemoteStreamForPeer, setRemoteScreenStreamForPeer } = useRoomStore();

  const upsertConn = useCallback((peerId: string, patch: Partial<Conn>) => {
    const existing = connsRef.current.get(peerId) ?? { mc: null, sc: null, dc: null };
    connsRef.current.set(peerId, { ...existing, ...patch });
  }, []);

  const pruneConn = useCallback((peerId: string) => {
    const existing = connsRef.current.get(peerId);
    if (existing && !existing.mc && !existing.sc && !existing.dc) connsRef.current.delete(peerId);
  }, []);

  const refreshPeers = useCallback(() => {
    const peers = Array.from(connsRef.current.entries())
      .filter(([, c]) => c.mc || c.sc || c.dc)
      .map(([pid]) => pid);
    setConnectedPeers(peers);
    cbRef.current.onConnectionChange(peers.length > 0, peers.length);
  }, []);

  const handleIncomingData = useCallback((data: unknown) => {
    const msg = data as Msg;

    switch (msg.type) {
      case 'chat':
        cbRef.current.onChatMessage(msg.payload);
        break;
      case 'transcript':
        cbRef.current.onTranscriptReceived?.(msg.payload);
        break;
      case 'participant-update':
        cbRef.current.onParticipantUpdate(msg.payload);
        break;
    }
  }, []);

  useEffect(() => {
    if (opts.enabled === false) return;

    const peer = new Peer(opts.myId, {
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

    peer.on('connection', (conn) => {
      const peerId = conn.peer;
      upsertConn(peerId, { dc: conn });

      conn.on('open', () => {
        cbRef.current.onPeerConnected?.(peerId);
        refreshPeers();
      });
      conn.on('data', (data) => handleIncomingData(data));
      conn.on('close', () => {
        const existing = connsRef.current.get(peerId);
        if (existing) existing.dc = null;
        pruneConn(peerId);
        refreshPeers();
      });
      refreshPeers();
    });

    peer.on('call', (call) => {
      const peerId = call.peer;
      const kind = call.metadata?.kind === 'screen' ? 'screen' : 'camera';

      call.answer(kind === 'camera' ? localStreamRef.current ?? undefined : undefined);
      upsertConn(peerId, kind === 'screen' ? { sc: call } : { mc: call });

      call.on('stream', (remoteStream) => {
        if (kind === 'screen') {
          setRemoteScreenStreamForPeer(peerId, remoteStream);
        } else {
          cbRef.current.onRemoteStream(remoteStream, peerId);
          setRemoteStreamForPeer(peerId, remoteStream);
        }
        refreshPeers();
      });

      call.on('close', () => {
        const existing = connsRef.current.get(peerId);
        if (existing) {
          if (kind === 'screen') existing.sc = null;
          else existing.mc = null;
        }
        if (kind === 'screen') setRemoteScreenStreamForPeer(peerId, null);
        else setRemoteStreamForPeer(peerId, null);
        pruneConn(peerId);
        cbRef.current.onParticipantLeft(peerId);
        refreshPeers();
      });
      refreshPeers();
    });

    peer.on('open', () => {
      clearTimeout(readyTimer);
      setIsReady(true);
      setError(null);
    });

    peer.on('error', (err) => {
      clearTimeout(readyTimer);
      setIsReady(true);
      if (err.type === 'unavailable-id') setError(opts.isHost ? 'الغرفة مستخدمة بالفعل' : null);
    });

    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });

    return () => {
      clearTimeout(readyTimer);
      connsRef.current.forEach((c, peerId) => {
        c.mc?.close();
        c.sc?.close();
        c.dc?.close();
        setRemoteStreamForPeer(peerId, null);
        setRemoteScreenStreamForPeer(peerId, null);
      });
      connsRef.current.clear();
      peer.destroy();
    };
  }, [
    opts.roomId,
    opts.isHost,
    opts.enabled,
    opts.myId,
    upsertConn,
    pruneConn,
    refreshPeers,
    handleIncomingData,
    setRemoteStreamForPeer,
    setRemoteScreenStreamForPeer
  ]);

  const connectToPeer = useCallback(async (targetPeerId: string, stream: MediaStream) => {
    localStreamRef.current = stream;
    const peer = peerRef.current;
    if (!peer || !targetPeerId || targetPeerId === opts.myId) return false;

    const existing = connsRef.current.get(targetPeerId);
    if (existing?.mc && existing?.dc) return true;

    if (!peer.open) {
      await new Promise<void>((resolve) => {
        peer.once('open', () => resolve());
        setTimeout(resolve, 4000);
      });
    }

    try {
      const dataConn = existing?.dc?.open ? existing.dc : peer.connect(targetPeerId);
      upsertConn(targetPeerId, { dc: dataConn });
      dataConn.on('open', () => {
        cbRef.current.onPeerConnected?.(targetPeerId);
        refreshPeers();
      });
      dataConn.on('data', (data) => handleIncomingData(data));
      dataConn.on('close', () => {
        const current = connsRef.current.get(targetPeerId);
        if (current) current.dc = null;
        pruneConn(targetPeerId);
        refreshPeers();
      });

      const call = peer.call(targetPeerId, stream, { metadata: { kind: 'camera' } });
      upsertConn(targetPeerId, { mc: call });
      call.on('stream', (remoteStream) => {
        cbRef.current.onRemoteStream(remoteStream, targetPeerId);
        setRemoteStreamForPeer(targetPeerId, remoteStream);
        refreshPeers();
      });
      call.on('close', () => {
        const current = connsRef.current.get(targetPeerId);
        if (current) current.mc = null;
        setRemoteStreamForPeer(targetPeerId, null);
        pruneConn(targetPeerId);
        refreshPeers();
      });

      return true;
    } catch (e) {
      console.error('connectToPeer error:', e);
      return false;
    }
  }, [opts.myId, upsertConn, pruneConn, refreshPeers, handleIncomingData, setRemoteStreamForPeer]);

  const connectToHost = useCallback(async (stream: MediaStream) => {
    return connectToPeer(opts.hostId || opts.roomId, stream);
  }, [connectToPeer, opts.hostId, opts.roomId]);

  const sendData = useCallback((msg: Msg) => {
    connsRef.current.forEach((conn) => {
      if (conn.dc?.open) conn.dc.send(msg);
    });
  }, []);

  const setLocalStream = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;
  }, []);

  const startScreenShare = useCallback((stream: MediaStream) => {
    const peer = peerRef.current;
    if (!peer?.open) return;

    connsRef.current.forEach((conn, peerId) => {
      conn.sc?.close();
      const call = peer.call(peerId, stream, { metadata: { kind: 'screen' } });
      conn.sc = call;
      call.on('close', () => {
        const current = connsRef.current.get(peerId);
        if (current) current.sc = null;
      });
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    connsRef.current.forEach((conn) => {
      conn.sc?.close();
      conn.sc = null;
    });
  }, []);

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    connsRef.current.forEach((conn) => {
      if (conn.mc && track && conn.mc.peerConnection) {
        const sender = conn.mc.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(track).catch(console.error);
      }
    });
  }, []);

  const disconnect = useCallback(() => {
    connsRef.current.forEach((conn, peerId) => {
      conn.mc?.close();
      conn.sc?.close();
      conn.dc?.close();
      setRemoteStreamForPeer(peerId, null);
      setRemoteScreenStreamForPeer(peerId, null);
    });
    connsRef.current.clear();
    refreshPeers();
  }, [refreshPeers, setRemoteStreamForPeer, setRemoteScreenStreamForPeer]);

  return {
    isReady,
    error,
    connectedPeers,
    myPeerId: peerRef.current?.id ?? '',
    connectToHost,
    connectToPeer,
    setLocalStream,
    startScreenShare,
    stopScreenShare,
    replaceVideoTrack,
    disconnect,
    sendData
  };
}
