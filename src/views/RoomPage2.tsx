import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useSpeechToText } from '@/app-hooks/useSpeechToText';
import { useRealtimeTranslation } from '@/app-hooks/useRealtimeTranslation';
import { usePeerConnection } from '@/app-hooks/usePeerConnection';
import { useSocketRoom } from '@/app-hooks/useSocketRoom';
import { useMediaDevices } from '@/app-hooks/useMediaDevices';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { detectBrowserLanguage, getLanguageName } from '@/config/languages';
import LanguageSelector from '@/ui/LanguageSelector';
import VideoGrid from '@/ui/VideoGrid';
import SidePanel from '@/ui/SidePanel';
import MeetingControls from '@/ui/MeetingControls';
import MicStatusIndicator from '@/ui/MicStatusIndicator';
import { playJoinSound, playMessageSound } from '@/utils/sounds';
import {
  Mic, MicOff, Video, VideoOff, Copy, Check, UserPlus, Radio, ArrowRight,
  Link2, Share2, Users, X, Zap, Sparkles
} from 'lucide-react';
import type { ParticipantRole, ChatMessage, Participant, TranscriptEntry } from '@/types';

interface RoomPageProps {
  roomId: string;
  role: ParticipantRole;
  onLeave: () => void;
}

type RoomPhase = 'setup' | 'connecting' | 'active';

export default function RoomPage2({ roomId, role, onLeave }: RoomPageProps) {
  // ─── State ────────────────────────────────────────────────────────
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);
  const isRtl = ['ar', 'fa', 'ur'].includes(uiLanguage);

  const [phase, setPhase] = useState<RoomPhase>('setup');
  const [name, setName] = useState('');
  const [myLanguage, setMyLanguage] = useState(role === 'host' ? detectBrowserLanguage() : 'en');
  const [partnerLanguage, setPartnerLanguage] = useState(role === 'host' ? 'en' : 'ar');
  const [copied, setCopied] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [participantId] = useState(() => uuid());
  const normalizedRoomId = roomId.trim().toLowerCase();
  // We use a predictable ID for the host's PeerJS to avoid signaling delays in production
  const myPeerId = useMemo(() => role === 'host' ? normalizedRoomId : `guest-${uuid().slice(0, 8)}`, [role, normalizedRoomId]);

  const [enableCamera, setEnableCamera] = useState(true);
  const [enableMic, setEnableMic] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [customRoomId, setCustomRoomId] = useState(roomId);

  // ─── Refs ─────────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null); // Persistent TTS player ref
  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);


  const myLanguageRef = useRef(myLanguage);
  useEffect(() => { myLanguageRef.current = myLanguage; }, [myLanguage]);

  const participantIdRef = useRef(participantId);
  useEffect(() => { participantIdRef.current = participantId; }, [participantId]);

  const isListeningRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  // تتبع إرادة المستخدم (هل يجب أن يستمع) بصرف نظر عن الحالة الفعلية
  const shouldListenRef = useRef(false);

  // ─── Stores & Hooks ───────────────────────────────────────────────
  const { processRecognizedText, speakText } = useRealtimeTranslation();
  const {
    processingStatus, sidePanelOpen, participants,
    isMicOn, isCameraOn: isCameraOnStore, audioPlaybackEnabled,
    setMicOn, setCameraOn, addParticipant, updateParticipant,
    addChatMessage, setMyId: setStoreMyId,
    setProcessingStatus, createRoom, leaveRoom, setLocalStream: setStoreLocalStream,
    setRemoteStream, addTranscript, updateTranscript
  } = useRoomStore();

  const {
    startCamera,
    stopCamera,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cameraError
  } = useMediaDevices();

  // ─── Peer Connection Handlers ────────────────────────────────────
  const handleRemoteStream = useCallback((stream: MediaStream, _peerId?: string) => {
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false; // الصوت الأصلي للطرف الآخر
      remoteAudioRef.current.play().catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRemoteStream]);

  // هنا يتم ربط الدردشة حيث تستقبل كل الأطراف بشكل فوري وقوي عبر القناة الأصلية (RTCDataChannel)
  const handleChatMessage = useCallback((message: ChatMessage) => {
    addChatMessage(message);
    if (message.senderId !== participantId) playMessageSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addChatMessage, participantId]);



  const handleConnectionChange = useCallback((connected: boolean) => {
    if (connected) setPhase(prev => prev === 'connecting' ? 'active' : prev);
  }, []);

  // هنا يتم استقبال الصوت (النص المترجم) وتشغيله
  // نتجاهل النصوص اللي بعثناها نحن (عشان منكررش العربي)
  const lastSpokenTranscriptIdRef = useRef<string | null>(null);

  const handleTranscriptReceived = useCallback(async (transcript: TranscriptEntry) => {
    // Show all transcripts, including local ones (server-side truth)
    addTranscript(transcript);

    // AI VOICE FALLBACK: If we receive a translated transcript from someone else,
    // and we haven't played it yet, play it locally using browser/config TTS.
    if (
      audioPlaybackEnabled &&
      transcript.speakerId !== participantId &&
      transcript.translatedText &&
      transcript.translatedText !== transcript.originalText &&
      lastSpokenTranscriptIdRef.current !== transcript.id
    ) {
      console.log('[TTS] Playing local fallback for:', transcript.id);
      lastSpokenTranscriptIdRef.current = transcript.id;
      speakText(transcript.translatedText, transcript.translatedLanguage);
    }
  }, [addTranscript, audioPlaybackEnabled, participantId, speakText]);

  /**
   * Full-Duplex TTS Handler
   * الميكروفون مش بيتوقف خالص — الاتنين يقدروا يتكلموا في نفس الوقت.
   * TTS بيشتغل في الـ background والميكروفون فاضل شغّال.
   */
  const handleTranslatedAudio = useCallback((data: {
    originalId: string;
    speakerName: string;
    originalText: string;
    translatedText: string;
    translatedLanguage: string;
    audioBase64: string;
  }) => {
    if (!data.translatedText?.trim()) return;

    // Mark as played to avoid double playback from handleTranscriptReceived fallback
    lastSpokenTranscriptIdRef.current = data.originalId;

    // تحديث النص المترجم في الـ UI
    updateTranscript(data.originalId, {
      translatedText: data.translatedText,
      translatedLanguage: data.translatedLanguage,
    });

    // تحديث الـ status فقط — الميكروفون فاضل شغّال
    setProcessingStatus({ stage: 'synthesizing', message: t.synthesizingStatus(data.speakerName) });

    const afterPlay = () => {
      if (shouldListenRef.current) {
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
      } else {
        setProcessingStatus({ stage: 'idle', message: '' });
      }
    };

    // استخدام الـ ref المباشر بدل getElementById لضمان الوصول دايماً
    if (data.audioBase64) {
      const audio = ttsAudioRef.current;
      if (audio) {
        audio.pause();
        audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
        audio.onended = afterPlay;
        audio.onerror = () => { console.warn('[TTS] Audio play error'); afterPlay(); };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[TTS] Autoplay blocked:', err);
            afterPlay();
          });
        }
        return;
      }
    }

    afterPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTranscript, setProcessingStatus, t]);

  const {
    sendChatMessage: socketSendChat,
    sendTranscript: socketSendTranscript,
    updateParticipant: socketUpdateParticipant,
    disconnect: socketDisconnect
  } = useSocketRoom({
    roomId: normalizedRoomId,
    participant: {
      id: participantIdRef.current,
      peerId: myPeerId,
      name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera,
      isScreenSharing: false, isConnected: true,
    },
    enabled: phase !== 'setup',
    onChatMessage: handleChatMessage,
    onTranscriptReceived: handleTranscriptReceived,
    onTranslatedAudio: handleTranslatedAudio
  });

  // Server-side translation for single-user local preview.
  const translateRest = async (text: string, sourceLang: string, targetLang: string) => {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Translation failed: ${res.status}`);
    }
    return String(data.translated || '').trim();
  };

  const {
    isReady: isPeerReady,
    error: peerError,
    connectedPeers,
    connectToHost,
    connectToPeer,
    setLocalStream: setPeerLocalStream,
    startScreenShare: peerStartScreenShare,
    stopScreenShare: peerStopScreenShare,
    replaceVideoTrack,
    disconnect: peerDisconnect,
    sendData: peerSendData
  } = usePeerConnection({
    roomId: normalizedRoomId, isHost: role === 'host',
    myId: myPeerId,
    hostId: normalizedRoomId, // Predictable Host ID
    enabled: phase !== 'setup',
    onRemoteStream: handleRemoteStream,
    onChatMessage: handleChatMessage,
    onParticipantUpdate: (p) => updateParticipant(p.id, p),
    onParticipantLeft: () => { /* Logic to remove peer if needed */ },
    onConnectionChange: handleConnectionChange,
    onPeerConnected: () => { },
    onTranscriptReceived: handleTranscriptReceived,
  });

  const prevPeersRef = useRef<string[]>([]);
  useEffect(() => {
    const newPeers = connectedPeers.filter(p => !prevPeersRef.current.includes(p));
    if (newPeers.length > 0) {
      playJoinSound();
    }
    prevPeersRef.current = connectedPeers;
  }, [connectedPeers]);

  // ─── Link Helpers ────────────────────────────────────────────────
  const getInviteLink = useCallback(() => `${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`, [normalizedRoomId]);

  const handleCopyLink = useCallback(async () => {
    const link = getInviteLink();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        return;
      }
    } catch { }
    const textArea = document.createElement('textarea');
    textArea.value = link;
    textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInviteLink]);

  const handleCopyRoomCode = useCallback(async () => {
    const code = normalizedRoomId.toUpperCase();
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  }, [normalizedRoomId]);

  const handleShareLink = useCallback(async () => {
    const link = getInviteLink();
    if (navigator.share) {
      try { await navigator.share({ title: t.inviteModalTitle, url: link }); return; } catch { }
    }
    handleCopyLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInviteLink, handleCopyLink, t]);

  // ─── Speech & Media ──────────────────────────────────────────────
  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    processRecognizedText(text, isFinal, {
      speakerId: participantId, speakerName: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage,
    }, async (entry) => {
      // 1. Try sending via Socket.IO
      socketSendTranscript(entry);

      // 2. Backup: Send via PeerJS Data Channel (Direct)
      peerSendData({ type: 'transcript', payload: entry });

      // 3. If alone in room, still show a real server translation for local preview.
      if (isFinal && participants.length === 1) {
        try {
          const translated = await translateRest(entry.originalText, myLanguage, partnerLanguage);
          updateTranscript(entry.id, { translatedText: translated, translatedLanguage: partnerLanguage });
        } catch (err) {
          console.error('Server translation error:', err);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, socketSendTranscript, peerSendData, participants.length, updateTranscript, t]);

  const { isListening, isSupported, startListening, stopListening } = useSpeechToText({
    language: myLanguage,
    onResult: handleSpeechResult,
  });

  useEffect(() => {
    isListeningRef.current = isListening;
    stopListeningRef.current = stopListening;
    startListeningRef.current = startListening;
  }, [isListening, stopListening, startListening]);

  useEffect(() => {
    setStoreMyId(participantId);
    if (role === 'host') createRoom(normalizedRoomId, participantId);
    return () => {
      stopListening();
      socketDisconnect();
      peerDisconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      leaveRoom();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'connecting' && isPeerReady && role === 'guest' && localStream) {
      console.log('🚀 Guest initiating direct P2P connection to Host...');
      connectToHost(localStream);
    }
  }, [phase, isPeerReady, role, connectToHost, localStream]);

  useEffect(() => {
    if (phase === 'setup' || !isPeerReady || !localStream) return;
    participants
      .map((p) => p.peerId)
      .filter((peerId): peerId is string => Boolean(peerId && peerId !== myPeerId))
      .forEach((peerId) => {
        connectToPeer(peerId, localStream);
      });
  }, [phase, isPeerReady, localStream, participants, myPeerId, connectToPeer]);


  const getMediaStream = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: enableCamera ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return null; }
    }
    if (stream && !enableMic) stream.getAudioTracks().forEach(t => { t.enabled = false; });
    localStreamRef.current = stream;
    setLocalStreamState(stream);
    setStoreLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableMic, enableCamera, setStoreLocalStream]);

  const handleStartSession = useCallback(async () => {
    if (customRoomId && customRoomId !== roomId) {
      window.location.hash = `/room/${customRoomId}`;
      return;
    }

    setPhase('connecting');
    const myParticipant: Participant = {
      id: participantId, peerId: myPeerId, name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera,
      isScreenSharing: false, isConnected: true,
    };
    addParticipant(myParticipant);
    setMicOn(enableMic);
    setCameraOn(enableCamera);

    const stream = await getMediaStream();
    if (stream) {
      // Ensure tracks match the intended state
      stream.getAudioTracks().forEach(track => {
        track.enabled = enableMic;
      });
      setPeerLocalStream(stream);

      // IMPORTANT: Only start STT after the stream is definitely ready
      if (enableMic && isSupported) {
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
        shouldListenRef.current = true;

        if (role === 'host') {
          console.log('[Mic] Starting STT with ready stream...');
          startListening();
          setMicOn(true);
        } else {
          setTimeout(() => {
            console.log('[Guest] Starting STT with ready stream...');
            startListening();
            setMicOn(true);
          }, 1200);
        }
      }
    }

    // Unlock audio autoplay by playing a silent audio via the persistent ref
    const ttsPlayer = ttsAudioRef.current;
    if (ttsPlayer) {
      ttsPlayer.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXv7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/////////////wAAAEhMYXZjNTkuMzcuMTAwAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs9SR+AAAAAAAAAAAAAAAAAAAA//OEAQAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEAwAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEBAAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
      ttsPlayer.play().catch(() => { /* Autoplay unlock attempt */ });
    }

    setCameraOn(enableCamera);
    setTimeout(() => setPhase('active'), role === 'host' ? 0 : 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, name, role, myLanguage, enableMic, enableCamera, addParticipant, getMediaStream, setPeerLocalStream, connectToHost, isSupported, startListening, setMicOn, setCameraOn, setProcessingStatus, t]);

  const handleToggleMic = useCallback(() => {
    const nextState = !isMicOn;
    console.log(`[Mic] Toggling to: ${nextState}`);
    
    // 1. Toggle actual Audio Tracks for WebRTC
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      console.log(`[Mic] Found ${tracks.length} audio tracks. Setting enabled=${nextState}`);
      tracks.forEach(track => {
        track.enabled = nextState;
      });
    } else {
      console.warn('[Mic] No local stream found to toggle tracks');
    }

    // 2. Toggle Speech-to-Text
    if (nextState) {
      shouldListenRef.current = true;
      startListening();
      setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
    } else {
      shouldListenRef.current = false;
      stopListening();
      setProcessingStatus({ stage: 'idle', message: '' });
    }

    // 3. Update State & Broadcast
    setMicOn(nextState);
    const updates = { isMicOn: nextState };
    updateParticipant(participantId, updates);
    socketUpdateParticipant(updates);
    peerSendData({ type: 'participant-update', payload: { id: participantId, ...updates } as Participant });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMicOn, startListening, stopListening, setMicOn, setProcessingStatus, updateParticipant, participantId, socketUpdateParticipant, peerSendData, t]);

  const handleToggleCamera = useCallback(async () => {
    const wasOn = enableCamera;
    const nextOn = !wasOn;
    
    // Update local UI state immediately for responsiveness
    setEnableCamera(nextOn);
    setCameraOn(nextOn);
    const updates = { isCameraOn: nextOn };
    updateParticipant(participantId, updates);
    socketUpdateParticipant(updates);
    peerSendData({ type: 'participant-update', payload: { id: participantId, ...updates } as Participant });
    
    if (nextOn) {
      const stream = await startCamera();
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        replaceVideoTrack(videoTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
    } else {
      stopCamera();
      replaceVideoTrack(null);
    }
  }, [enableCamera, setCameraOn, updateParticipant, participantId, socketUpdateParticipant, peerSendData, startCamera, stopCamera, replaceVideoTrack]);




  const handleEndCall = useCallback(() => {
    stopListening();
    socketDisconnect();
    peerDisconnect();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setMicOn(false);
    setCameraOn(false);
    onLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopListening, socketDisconnect, peerDisconnect, setMicOn, setCameraOn, onLeave]);

  // ─── PREMIUM UI RENDERERS ────────────────────────────────────────

  const renderInviteModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowInviteModal(false)} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[32px] p-8 shadow-[0_0_80px_rgba(163,230,53,0.15)]" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-#A3E635/50 to-transparent" />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-brr from-[#A3E635] to-[#007fb4] flex items-center justify-center shadow-lg shadow-#A3E635/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">{t.inviteModalTitle}</h3>
              <p className="text-sm text-gray-400 font-medium">{connectedPeers.length} {t.inviteModalActive}</p>
            </div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          <div className="relative group cursor-pointer" onClick={handleCopyLink} title={t.copyRoomLinkBtn}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#A3E635] to-[#007fb4] rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4">
              <p className="text-sm font-mono text-gray-300 break-all select-all text-left" dir="ltr">{getInviteLink()}</p>
              <Copy className="w-5 h-5 text-[#65A30D] shrink-0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={handleCopyLink} className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-[#A3E635] hover:bg-#65A30D text-white shadow-lg shadow-#A3E635/20'}`}>
              {copied ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomLinkBtn}</>}
            </button>
            <button onClick={handleShareLink} className="py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-colors">
              <Share2 className="w-5 h-5" /> {t.shareBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex items-center justify-center p-3 sm:p-4 bg-gray-50 dark:bg-[#00040d] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Premium Ambient Background */}
      <div className="absolute top-0 left-1/4 w-[260px] h-[260px] sm:w-[500px] sm:h-[500px] bg-[#A3E635]/20 rounded-full blur-[90px] sm:blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[260px] h-[260px] sm:w-[500px] sm:h-[500px] bg-lime-700/10 rounded-full blur-[90px] sm:blur-[120px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-3 sm:gap-6 animate-fade-up">
        {/* Left: Video Preview (Glassmorphism) */}
        <div className="order-2 lg:order-1 lg:col-span-7 rounded-[24px] sm:rounded-[40px] bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative aspect-[16/10] sm:aspect-video flex items-center justify-center group">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />

          {!enableCamera && (
            <div className="w-32 h-32 rounded-[32px] bg-gradient-to-brr from-white to-gray-100 dark:from-[#1a1a1a] dark:to-[#0a0a0a] border border-gray-200 dark:border-white/5 flex items-center justify-center shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-brr from-[#A3E635] to-[#007fb4] opacity-20 blur-xl rounded-full" />
              <span className="relative z-10 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-brr from-[#A3E635] to-[#007fb4]">
                {(name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)).charAt(0)}
              </span>
            </div>
          )}

          {/* Elegant Floating Controls */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-[#064E3B]lack/60 backdrop-blur-xl p-1.5 sm:p-2 rounded-[20px] sm:rounded-[24px] border border-white/10 shadow-2xl">
            <button onClick={() => setEnableMic(!enableMic)} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] flex items-center justify-center transition-all ${enableMic ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}>
              {enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button onClick={async () => {
              const next = !enableCamera;
              setEnableCamera(next);
              if (next) {
                const stream = await startCamera();
                if (stream && localVideoRef.current) {
                  localVideoRef.current.srcObject = stream;
                }
              } else {
                stopCamera();
              }
            }} className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] flex items-center justify-center transition-all ${enableCamera ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}>
              {enableCamera ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Right: Settings Card */}
        <div className="order-1 lg:order-2 lg:col-span-5 rounded-[24px] sm:rounded-[40px] bg-white/90 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 sm:p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-#A3E635/30 to-transparent" />

          <div className="flex-1 flex flex-col justify-center space-y-5 sm:space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-brr from-[#A3E635]/20 to-transparent border border-[#A3E635]/20 mb-3 sm:mb-4">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-[#65A30D]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t.roomSetupDesc}</p>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 px-1">{t.roomCodeLabel}</label>
                <div className="relative">
                  <input type="text" value={customRoomId} onChange={(e) => setCustomRoomId(e.target.value.toLowerCase())} dir="ltr" className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-[18px] sm:rounded-[20px] bg-gray-50 dark:bg-[#064E3B]lack/40 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-600 font-mono tracking-widest focus:outline-none focus:border-[#A3E635] focus:ring-1 focus:ring-#A3E635 transition-all lowercase" style={{ paddingLeft: isRtl ? '3.5rem' : '1.25rem', paddingRight: isRtl ? '1.25rem' : '3.5rem' }} />
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 text-[#65A30D] flex items-center justify-center hover:border-[#A3E635]/50 transition-colors ${isRtl ? 'left-2' : 'right-2'}`}
                    title={t.copyRoomLinkBtn}
                  >
                    {copiedRoomCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 px-1">{t.nameLabel}</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} dir="auto" className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-[18px] sm:rounded-[20px] bg-gray-50 dark:bg-[#064E3B]lack/40 border border-gray-200 dark:border-white/10 text-gray-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-600 focus:outline-none focus:border-[#A3E635] focus:ring-1 focus:ring-#A3E635 transition-all" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <LanguageSelector value={myLanguage} onChange={setMyLanguage} label={t.myLanguageLabel} />
                </div>
                <div className="space-y-2">
                  <LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label={t.partnerLanguageLabel} />
                </div>
              </div>

              {peerError && <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center justify-center">⚠️ {peerError}</div>}
            </div>
          </div>

          <button onClick={handleStartSession} className="mt-6 sm:mt-8 w-full py-4 sm:py-5 bg-gradient-to-r from-[#A3E635] to-[#007fb4] hover:from-#65A30D hover:to-[#ff6120] text-white rounded-[20px] sm:rounded-[24px] text-base sm:text-lg font-black flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(163,230,53,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Zap className="w-6 h-6" /> {role === 'host' ? t.startButtonHost : t.startButtonGuest}
          </button>
        </div>
      </div>
    </div>
  );

  const renderConnecting = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex items-center justify-center p-4 bg-gray-50 dark:bg-[#00040d] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] sm:w-[400px] sm:h-[400px] bg-[#A3E635]/10 rounded-full blur-[90px] sm:blur-[100px] animate-pulse" />

      <div className="relative z-10 text-center max-w-md animate-fade-up">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8">
          <div className="absolute inset-0 border-4 border-[#A3E635]/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#A3E635] rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Radio className="w-8 h-8 text-[#65A30D] animate-pulse" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white mb-3 sm:mb-4 tracking-tight">{role === 'host' ? t.waitingForGuest : t.connectingSecurely}</h2>
        <p className="text-gray-500 dark:text-gray-400">{t.establishingP2P}</p>

        {role === 'host' && (
          <div className="mt-8 sm:mt-10 p-4 sm:p-6 bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Link2 className="w-5 h-5 text-[#65A30D]" />
              <span className="font-bold text-gray-950 dark:text-white text-sm">{t.shareLinkPrompt}</span>
            </div>
            <div className="bg-gray-50 dark:bg-[#064E3B]lack/50 rounded-[20px] p-4 mb-4 border border-gray-200 dark:border-white/5 cursor-pointer hover:border-[#A3E635]/50 transition-colors" onClick={handleCopyLink} title={t.copyRoomLinkBtn}>
              <p className="text-xs font-mono text-[#65A30D] break-all text-left" dir="ltr">{getInviteLink()}</p>
            </div>
            <button onClick={handleCopyLink} className={`w-full py-4 rounded-[20px] font-bold flex justify-center items-center gap-2 transition-all ${copied ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-[#A3E635] hover:bg-#65A30D text-white shadow-[0_0_20px_rgba(163,230,53,0.3)]'}`}>
              {copied ? t.linkCopied : t.copyRoomLinkBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (enableMic && !isSupported && phase === 'active') {
      setProcessingStatus({ stage: 'error', message: 'المتصفح لا يدعم الترجمة الصوتية' });
    }
  }, [enableMic, isSupported, phase, setProcessingStatus]);

  const renderActive = () => (
    <div className="h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] flex flex-col bg-gray-50 dark:bg-[#00040d] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      {showInviteModal && renderInviteModal()}

      {/* Top Glass Header */}
      <div className="bg-white/85 dark:bg-white/5 backdrop-blur-2xl border-b border-gray-200 dark:border-white/10 px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between z-40 shadow-sm relative gap-3 sm:gap-0">
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#064E3B]lack/40 px-3 sm:px-4 py-2 rounded-2xl border border-gray-200 dark:border-white/5">
            <div className={`w-2 h-2 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-[#A3E635]'} animate-pulse`} />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{participants.length} {t.onlineCount}</span>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#A3E635]/10 hover:bg-[#A3E635]/20 border border-[#A3E635]/20 text-[#65A30D] text-sm font-bold rounded-2xl transition-all">
            <UserPlus className="w-4 h-4" /> {t.inviteBtn}
          </button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
          <MicStatusIndicator isRecording={isMicOn} volume={0} processingStatus={processingStatus} />
        </div>

        <div className="flex items-center gap-4 sm:mt-0">
          <div className="w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 bg-gray-100 dark:bg-white/5 px-3 sm:px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-inner">
            <span className="min-w-0 truncate text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{getLanguageName(myLanguage)}</span>
            <ArrowRight className={`w-4 h-4 text-[#65A30D] ${isRtl ? 'scale-x-[-1]' : ''}`} />
            <span className="min-w-0 truncate text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{getLanguageName(partnerLanguage)}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative p-2 sm:p-4 gap-2 sm:gap-4 bg-gray-50 dark:bg-[#00040d]">
        <div className={`min-h-0 rounded-[20px] sm:rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-[#0a0a0a] transition-all duration-300 flex-1`}>
          <VideoGrid />
        </div>

        {/* Sleek Integrated SidePanel */}
        {sidePanelOpen && (
          <div className={`fixed ${isRtl ? 'left-2' : 'right-2'} top-[10.75rem] bottom-[5.25rem] sm:bottom-[6rem] lg:static lg:inset-auto w-auto lg:w-[400px] lg:flex-none lg:h-full rounded-[22px] sm:rounded-[32px] overflow-hidden bg-white/95 dark:bg-[#065F46]/95 lg:dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.55)] flex flex-col z-50 animate-fade-in shrink-0`}>
            <SidePanel
              myId={participantId}
              myName={name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)}
              myRole={role}
              myLanguage={myLanguage}
              partnerLanguage={partnerLanguage}
              onSendMessage={(msg) => {
                addChatMessage(msg);
                socketSendChat(msg);
                peerSendData({ type: 'chat', payload: msg });
              }}
            />
          </div>
        )}
      </div>

      <MeetingControls
        roomId={roomId}
        onEndCall={handleEndCall}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onStartScreenShare={peerStartScreenShare}
        onStopScreenShare={peerStopScreenShare}
      />
    </div>
  );

  return (
    <>
      {/* TTS Audio Player — always in DOM to allow autoplay unlock and instant playback */}
      <audio
        ref={ttsAudioRef}
        id="tts-audio-player"
        playsInline
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: -9999 }}
      />
      {phase === 'setup' ? renderSetup() : phase === 'connecting' ? renderConnecting() : renderActive()}
    </>
  );
}
