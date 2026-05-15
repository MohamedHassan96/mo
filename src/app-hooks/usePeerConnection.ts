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

  const { setRemoteStream } = useRoomStore();

  const refreshPeers = useCallback(() => {
    const peers = Array.from(connsRef.current.entries())
      .filter(([_, c]) => c.mc || c.dc)
      .map(([pid, _]) => pid);
    setConnectedPeers(peers);
    cbRef.current.onConnectionChange(peers.length > 0, peers.length);
  }, []);

  const handleIncomingData = useCallback((data: any, fromPeerId: string) => {
    const msg = data as Msg;
    console.log(`📩 P2P Data from ${fromPeerId}:`, msg.type);
    
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

    // Handle Incoming Data Channels
    peer.on('connection', (conn) => {
      console.log(`🔌 P2P Data Channel opened by: ${conn.peer}`);
      const pid = conn.peer;
      
      const upsert = () => {
        const existing = connsRef.current.get(pid);
        if (existing) { existing.dc = conn; }
        else connsRef.current.set(pid, { mc: null, dc: conn });
      };
      upsert();

      conn.on('data', (data) => handleIncomingData(data, pid));
      conn.on('close', () => {
        connsRef.current.delete(pid);
        refreshPeers();
      });
      refreshPeers();
    });

    // Handle Incoming Calls
    peer.on('call', (call) => {
      const pid = call.peer;
      console.log(`📞 Incoming call from: ${pid}`);

      const stream = localStreamRef.current;
      call.answer(stream || undefined);

      const upsert = () => {
        const existing = connsRef.current.get(pid);
        if (existing) { existing.mc = call; }
        else connsRef.current.set(pid, { mc: call, dc: null });
      };
      upsert();

      call.on('stream', (remoteStream) => {
        cbRef.current.onRemoteStream(remoteStream, pid);
        setRemoteStream(remoteStream);
        refreshPeers();
      });

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
    });

    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });

    return () => {
      clearTimeout(readyTimer);
      connsRef.current.forEach(c => {
        c.mc?.close();
        c.dc?.close();
      });
      connsRef.current.clear();
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId, opts.isHost, opts.enabled, opts.myId]);

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
    console.log(`🔌 P2P: Connecting to Host: ${targetHostId}`);

    try {
      // 1. Data Connection
      const dataConn = peer.connect(targetHostId);
      dataConn.on('open', () => {
        console.log('✅ P2P Data Channel to Host open');
        const existing = connsRef.current.get(targetHostId);
        if (existing) existing.dc = dataConn;
        else connsRef.current.set(targetHostId, { mc: null, dc: dataConn });
        refreshPeers();
      });
      dataConn.on('data', (data) => handleIncomingData(data, targetHostId));

      // 2. Media Call
      const call = peer.call(targetHostId, stream);
      const existing = connsRef.current.get(targetHostId);
      if (existing) existing.mc = call;
      else connsRef.current.set(targetHostId, { mc: call, dc: null });

      call.on('stream', (remoteStream) => {
        cbRef.current.onRemoteStream(remoteStream, targetHostId);
        setRemoteStream(remoteStream);
        refreshPeers();
      });

      return true;
    } catch (e) {
      console.error('connectToHost error:', e);
      return false;
    }
  }, [opts.roomId, opts.hostId, refreshPeers, handleIncomingData, setRemoteStream]);

  const sendData = useCallback((msg: Msg) => {
    connsRef.current.forEach((conn, pid) => {
      if (conn.dc && conn.dc.open) {
        console.log(`📤 Sending P2P Data to ${pid}:`, msg.type);
        conn.dc.send(msg);
      }
    });
  }, []);

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
    connsRef.current.forEach(c => {
      c.mc?.close();
      c.dc?.close();
    });
    connsRef.current.clear();
    refreshPeers();
  }, [refreshPeers]);

  return {
    isReady, error, connectedPeers,
    myPeerId: peerRef.current?.id ?? '',
    connectToHost, setLocalStream,
    replaceVideoTrack, disconnect,
    sendData
  };
}
