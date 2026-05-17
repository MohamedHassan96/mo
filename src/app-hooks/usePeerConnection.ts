import { useCallback, useEffect, useRef, useState } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { useRoomStore } from '@/state/roomStore';
import type { ChatMessage, Participant, TranscriptEntry } from '@/types';

type Msg =
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'participant-update'; payload: Participant }
  | { type: 'transcript'; payload: TranscriptEntry }
  | { type: 'file-start'; payload: { id: string, name: string, size: number, type: string, senderName: string } }
  | { type: 'file-chunk'; payload: { id: string, chunk: ArrayBuffer | string, index: number } }
  | { type: 'file-end'; payload: { id: string } };

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
  onFileTransferStart?: (file: { id: string, name: string, size: number, senderName: string }) => void;
  onFileTransferProgress?: (id: string, progress: number) => void;
  onFileTransferComplete?: (id: string, blob: Blob, name: string) => void;
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
  const fileBuffersRef = useRef<Map<string, { chunks: any[], totalSize: number, receivedSize: number, metadata: any }>>(new Map());

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
      case 'chat': cbRef.current.onChatMessage(msg.payload); break;
      case 'transcript': cbRef.current.onTranscriptReceived?.(msg.payload); break;
      case 'participant-update': cbRef.current.onParticipantUpdate(msg.payload); break;
      case 'file-start':
        cbRef.current.onFileTransferStart?.(msg.payload);
        fileBuffersRef.current.set(msg.payload.id, { chunks: [], totalSize: msg.payload.size, receivedSize: 0, metadata: msg.payload });
        break;
      case 'file-chunk':
        const buffer = fileBuffersRef.current.get(msg.payload.id);
        if (buffer) {
          buffer.chunks[msg.payload.index] = msg.payload.chunk;
          buffer.receivedSize += (msg.payload.chunk as any).byteLength || 0;
          const progress = Math.min(100, Math.round((buffer.receivedSize / buffer.totalSize) * 100));
          cbRef.current.onFileTransferProgress?.(msg.payload.id, progress);
        }
        break;
      case 'file-end':
        const finalBuffer = fileBuffersRef.current.get(msg.payload.id);
        if (finalBuffer) {
          const blob = new Blob(finalBuffer.chunks, { type: finalBuffer.metadata.type });
          cbRef.current.onFileTransferComplete?.(msg.payload.id, blob, finalBuffer.metadata.name);
          fileBuffersRef.current.delete(msg.payload.id);
        }
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
        if (kind === 'screen') setRemoteScreenStreamForPeer(peerId, remoteStream);
        else {
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
        c.mc?.close(); c.sc?.close(); c.dc?.close();
        setRemoteStreamForPeer(peerId, null); setRemoteScreenStreamForPeer(peerId, null);
      });
      connsRef.current.clear();
      peer.destroy();
    };
  }, [
    opts.roomId, opts.isHost, opts.enabled, opts.myId,
    upsertConn, pruneConn, refreshPeers, handleIncomingData,
    setRemoteStreamForPeer, setRemoteScreenStreamForPeer
  ]);

  const sendData = useCallback((msg: Msg) => {
    connsRef.current.forEach((conn) => {
      if (conn.dc?.open) conn.dc.send(msg);
    });
  }, []);

  const sendFile = useCallback(async (file: File, senderName: string) => {
    const id = Math.random().toString(36).slice(2, 11);
    const CHUNK_SIZE = 16384; 
    sendData({ type: 'file-start', payload: { id, name: file.name, size: file.size, type: file.type, senderName } });

    const reader = new FileReader();
    let offset = 0;
    let index = 0;

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      if (e.target?.result) {
        sendData({ type: 'file-chunk', payload: { id, chunk: e.target.result, index } });
        offset += CHUNK_SIZE;
        index++;
        if (offset < file.size) readNextChunk();
        else sendData({ type: 'file-end', payload: { id } });
      }
    };
    readNextChunk();
  }, [sendData]);

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
        pruneConn(targetPeerId); refreshPeers();
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
        pruneConn(targetPeerId); refreshPeers();
      });
      return true;
    } catch (e) {
      console.error('connectToPeer error:', e); return false;
    }
  }, [opts.myId, upsertConn, pruneConn, refreshPeers, handleIncomingData, setRemoteStreamForPeer]);

  const connectToHost = useCallback(async (stream: MediaStream) => {
    return connectToPeer(opts.hostId || opts.roomId, stream);
  }, [connectToPeer, opts.hostId, opts.roomId]);

  const setLocalStream = useCallback((stream: MediaStream) => { localStreamRef.current = stream; }, []);

  const startScreenShare = useCallback((stream: MediaStream) => {
    const peer = peerRef.current; if (!peer?.open) return;
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
    connsRef.current.forEach((conn) => { conn.sc?.close(); conn.sc = null; });
  }, []);

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    connsRef.current.forEach((conn) => {
      if (conn.mc && conn.mc.peerConnection) {
        const sender = conn.mc.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(track).catch(console.error);
      }
    });
  }, []);

  const disconnect = useCallback(() => {
    connsRef.current.forEach((conn, peerId) => {
      conn.mc?.close(); conn.sc?.close(); conn.dc?.close();
      setRemoteStreamForPeer(peerId, null); setRemoteScreenStreamForPeer(peerId, null);
    });
    connsRef.current.clear(); refreshPeers();
  }, [refreshPeers, setRemoteStreamForPeer, setRemoteScreenStreamForPeer]);

  return {
    isReady, error, connectedPeers, myPeerId: peerRef.current?.id ?? '',
    connectToHost, connectToPeer, setLocalStream,
    startScreenShare, stopScreenShare, replaceVideoTrack, disconnect,
    sendData, sendFile
  };
}
