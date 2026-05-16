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
  const myPeerId = useMemo(() => role === 'host' ? normalizedRoomId : `guest-${uuid().slice(0, 8)}`, [role, normalizedRoomId]);

  const [enableCamera, setEnableCamera] = useState(false);
  const [enableMic, setEnableMic] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [customRoomId, setCustomRoomId] = useState(roomId);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const myLanguageRef = useRef(myLanguage);
  useEffect(() => { myLanguageRef.current = myLanguage; }, [myLanguage]);

  const participantIdRef = useRef(participantId);
  useEffect(() => { participantIdRef.current = participantId; }, [participantId]);

  const isListeningRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const shouldListenRef = useRef(false);

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
    replaceVideoTrack,
  } = useMediaDevices();

  const handleRemoteStream = useCallback((stream: MediaStream, _peerId?: string) => {
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch(() => { });
    }
  }, [setRemoteStream]);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    addChatMessage(message);
    if (message.senderId !== participantId) playMessageSound();
  }, [addChatMessage, participantId]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    if (connected) setPhase(prev => prev === 'connecting' ? 'active' : prev);
  }, []);

  const lastSpokenTranscriptIdRef = useRef<string | null>(null);

  const handleTranscriptReceived = useCallback(async (transcript: TranscriptEntry) => {
    addTranscript(transcript);
    if (
      audioPlaybackEnabled &&
      transcript.speakerId !== participantId &&
      transcript.translatedText &&
      transcript.translatedText !== transcript.originalText &&
      lastSpokenTranscriptIdRef.current !== transcript.id
    ) {
      lastSpokenTranscriptIdRef.current = transcript.id;
      speakText(transcript.translatedText, transcript.translatedLanguage);
    }
  }, [addTranscript, audioPlaybackEnabled, participantId, speakText]);

  const handleTranslatedAudio = useCallback((data: {
    originalId: string;
    speakerName: string;
    originalText: string;
    translatedText: string;
    translatedLanguage: string;
    audioBase64: string;
  }) => {
    if (!data.translatedText?.trim()) return;
    lastSpokenTranscriptIdRef.current = data.originalId;
    updateTranscript(data.originalId, {
      translatedText: data.translatedText,
      translatedLanguage: data.translatedLanguage,
    });

    setProcessingStatus({ stage: 'synthesizing', message: t.synthesizingStatus(data.speakerName) });

    const afterPlay = () => {
      if (shouldListenRef.current) {
        console.log('[TTS] Playback ended, resuming mic...');
        startListeningRef.current?.(); // Resume STT
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
      } else {
        setProcessingStatus({ stage: 'idle', message: '' });
      }
    };

    if (data.audioBase64) {
      const audio = ttsAudioRef.current;
      if (audio) {
        // AUTO-PAUSE MIC: Stop STT while TTS is playing to prevent feedback
        if (isListeningRef.current) {
          console.log('[TTS] Playback starting, pausing mic to prevent feedback...');
          stopListeningRef.current?.();
        }

        audio.pause();
        audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
        audio.onended = afterPlay;
        audio.onerror = () => afterPlay();
        audio.play().catch(() => afterPlay());
        return;
      }
    }
    afterPlay();
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

  const {
    isReady: isPeerReady,
    error: peerError,
    connectedPeers,
    connectToHost,
    connectToPeer,
    setLocalStream: setPeerLocalStream,
    startScreenShare: peerStartScreenShare,
    stopScreenShare: peerStopScreenShare,
    replaceVideoTrack: peerReplaceVideoTrack,
    disconnect: peerDisconnect,
    sendData: peerSendData
  } = usePeerConnection({
    roomId: normalizedRoomId, isHost: role === 'host',
    myId: myPeerId,
    hostId: normalizedRoomId,
    enabled: phase !== 'setup',
    onRemoteStream: handleRemoteStream,
    onChatMessage: handleChatMessage,
    onParticipantUpdate: (p) => updateParticipant(p.id, p),
    onConnectionChange: handleConnectionChange,
    onPeerConnected: () => { },
    onTranscriptReceived: handleTranscriptReceived,
  });

  const prevPeersCount = useRef(0);
  useEffect(() => {
    if (connectedPeers.length > prevPeersCount.current) playJoinSound();
    prevPeersCount.current = connectedPeers.length;
  }, [connectedPeers]);

  const getInviteLink = useCallback(() => `${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`, [normalizedRoomId]);

  const handleCopyLink = useCallback(async () => {
    const link = getInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch { }
  }, [getInviteLink]);

  const handleCopyRoomCode = useCallback(async () => {
    const code = normalizedRoomId.toUpperCase();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRoomCode(true);
      setTimeout(() => setCopiedRoomCode(false), 2000);
    } catch { }
  }, [normalizedRoomId]);

  const handleShareLink = useCallback(async () => {
    const link = getInviteLink();
    if (navigator.share) {
      try { await navigator.share({ title: t.inviteModalTitle, url: link }); return; } catch { }
    }
    handleCopyLink();
  }, [getInviteLink, handleCopyLink, t]);

  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    processRecognizedText(text, isFinal, {
      speakerId: participantId, speakerName: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage,
    }, async (entry) => {
      socketSendTranscript(entry);
      peerSendData({ type: 'transcript', payload: entry });
    });
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, socketSendTranscript, peerSendData, t]);

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
  }, []);

  useEffect(() => {
    if (phase === 'connecting' && isPeerReady && role === 'guest' && localStream) {
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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: enableCamera ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          }
        });
      } catch { return null; }
    }
    if (stream && !enableMic) stream.getAudioTracks().forEach(t => { t.enabled = false; });
    localStreamRef.current = stream;
    setLocalStreamState(stream);
    setStoreLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
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
      stream.getAudioTracks().forEach(track => { track.enabled = enableMic; });
      setPeerLocalStream(stream);
      if (enableMic && isSupported) {
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
        shouldListenRef.current = true;
        if (role === 'host') {
          startListening();
          setMicOn(true);
        } else {
          setTimeout(() => {
            startListening();
            setMicOn(true);
          }, 1200);
        }
      }
    }
    const ttsPlayer = ttsAudioRef.current;
    if (ttsPlayer) {
      ttsPlayer.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXv7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/////////////wAAAEhMYXZjNTkuMzcuMTAwAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs9SR+AAAAAAAAAAAAAAAAAAAA//OEAQAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEAwAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEBAAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
      ttsPlayer.play().catch(() => { });
    }
    setCameraOn(enableCamera);
    setTimeout(() => setPhase('active'), role === 'host' ? 0 : 2000);
  }, [participantId, name, role, myLanguage, enableMic, enableCamera, addParticipant, getMediaStream, setPeerLocalStream, connectToHost, isSupported, startListening, setMicOn, setCameraOn, setProcessingStatus, t]);

  const handleToggleMic = useCallback(() => {
    const nextState = !isMicOn;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = nextState; });
    }
    if (nextState) {
      shouldListenRef.current = true;
      startListening();
      setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
    } else {
      shouldListenRef.current = false;
      stopListening();
      setProcessingStatus({ stage: 'idle', message: '' });
    }
    setMicOn(nextState);
    const updates = { isMicOn: nextState };
    updateParticipant(participantId, updates);
    socketUpdateParticipant(updates);
    peerSendData({ type: 'participant-update', payload: { id: participantId, ...updates } as Participant });
  }, [isMicOn, startListening, stopListening, setMicOn, setProcessingStatus, updateParticipant, participantId, socketUpdateParticipant, peerSendData, t]);

  const handleToggleCamera = useCallback(async () => {
    const wasOn = isCameraOnStore;
    const nextOn = !wasOn;
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
        setPeerLocalStream(stream); // Update Peer connection ref
        replaceVideoTrack(videoTrack); // Update local store/UI
        peerReplaceVideoTrack(videoTrack); // Send to all current peers
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
    } else {
      stopCamera();
      // When camera is off, we still have audio in the stream
      if (localStreamRef.current) setPeerLocalStream(localStreamRef.current); 
      replaceVideoTrack(null); // Clear local UI
      peerReplaceVideoTrack(null); // Notify current peers
    }
  }, [isCameraOnStore, setCameraOn, updateParticipant, participantId, socketUpdateParticipant, peerSendData, startCamera, stopCamera, replaceVideoTrack, peerReplaceVideoTrack, setPeerLocalStream]);

  const handleEndCall = useCallback(() => {
    stopListening();
    socketDisconnect();
    peerDisconnect();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setMicOn(false);
    setCameraOn(false);
    onLeave();
  }, [stopListening, socketDisconnect, peerDisconnect, setMicOn, setCameraOn, onLeave]);

  const renderInviteModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-dark-950/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowInviteModal(false)} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-white dark:bg-bg-dark-900 border border-gray-200 dark:border-white/10 rounded-[32px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-neon/50 to-transparent" />
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-neon/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-dark dark:text-brand-neon" />
            </div>
            <div>
              <h3 className="text-xl font-black text-brand-dark dark:text-white/95">{t.inviteModalTitle}</h3>
              <p className="text-sm text-emerald-900/60 dark:text-white/60 font-medium">{connectedPeers.length} {t.inviteModalActive}</p>
            </div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 text-emerald-800/40 dark:text-white/40" /></button>
        </div>
        <div className="space-y-6">
          <div className="relative group cursor-pointer" onClick={handleCopyLink}>
            <div className="relative bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4">
              <p className="text-sm font-mono text-emerald-900/80 dark:text-white/80 break-all select-all text-left" dir="ltr">{getInviteLink()}</p>
              <Copy className="w-5 h-5 text-brand-neon shrink-0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={handleCopyLink} className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-lg shadow-brand-neon/20'}`}>
              {copied ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomLinkBtn}</>}
            </button>
            <button onClick={handleShareLink} className="py-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl font-bold text-brand-dark dark:text-white/90 flex items-center justify-center gap-2">
              <Share2 className="w-5 h-5" /> {t.shareBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex items-center justify-center p-3 sm:p-4 bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-neon/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-3 sm:gap-6 animate-fade-up">
        <div className="order-2 lg:order-1 lg:col-span-7 rounded-[32px] sm:rounded-[40px] bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden relative aspect-video flex items-center justify-center">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />
          {!enableCamera && (
            <div className="w-32 h-32 rounded-[40px] bg-white dark:bg-bg-dark-900 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-2xl relative">
              <span className="text-6xl font-black text-brand-neon">{(name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)).charAt(0)}</span>
            </div>
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/5 dark:bg-black/40 backdrop-blur-xl p-2.5 rounded-[28px] border border-black/5 dark:border-white/10 shadow-lg dark:shadow-none">
            <button 
              onClick={() => setEnableMic(!enableMic)} 
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-sm ${
                enableMic 
                  ? 'bg-white dark:bg-white/10 text-brand-dark dark:text-white hover:bg-gray-50' 
                  : 'bg-red-500 text-white shadow-red-500/20'
              }`}
            >
              {enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setEnableCamera(!enableCamera)} 
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-sm ${
                enableCamera 
                  ? 'bg-white dark:bg-white/10 text-brand-dark dark:text-white hover:bg-gray-50' 
                  : 'bg-red-500 text-white shadow-red-500/20'
              }`}
            >
              {enableCamera ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <div className="order-1 lg:order-2 lg:col-span-5 rounded-[32px] sm:rounded-[40px] bg-white/90 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl p-5 sm:p-8 flex flex-col justify-center space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-brand-neon/10 border border-brand-neon/20 mb-4">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-brand-neon" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-brand-dark dark:text-white/95">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h2>
            <p className="text-emerald-900/60 dark:text-white/60 mt-2 text-sm">{t.roomSetupDesc}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-emerald-900/70 dark:text-white/70 px-1">{t.roomCodeLabel}</label>
              <div className="relative">
                <input type="text" value={customRoomId} onChange={(e) => setCustomRoomId(e.target.value.toLowerCase())} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/10 text-brand-dark dark:text-white/90 focus:outline-none focus:border-brand-neon transition-all lowercase" />
                <button type="button" onClick={handleCopyRoomCode} className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-brand-neon flex items-center justify-center ${isRtl ? 'left-2' : 'right-2'}`}>
                  {copiedRoomCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-emerald-900/70 dark:text-white/70 px-1">{t.nameLabel}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/10 text-brand-dark dark:text-white/90 focus:outline-none focus:border-brand-neon transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <LanguageSelector value={myLanguage} onChange={setMyLanguage} label={t.myLanguageLabel} />
              <LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label={t.partnerLanguageLabel} />
            </div>
          </div>
          <button onClick={handleStartSession} className="w-full py-5 bg-brand-neon text-brand-dark rounded-[24px] text-lg font-black flex items-center justify-center gap-3 shadow-lg shadow-brand-neon/20 transition-all hover:scale-[1.02]">
            <Zap className="w-6 h-6" /> {role === 'host' ? t.startButtonHost : t.startButtonGuest}
          </button>
        </div>
      </div>
    </div>
  );

  const renderConnecting = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex items-center justify-center p-4 bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-neon/10 rounded-full blur-[100px] animate-pulse" />
      <div className="relative z-10 text-center max-w-md animate-fade-up">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-brand-neon/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-brand-neon rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center"><Radio className="w-8 h-8 text-brand-neon animate-pulse" /></div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-brand-dark dark:text-white/95 mb-4">{role === 'host' ? t.waitingForGuest : t.connectingSecurely}</h2>
        <p className="text-emerald-900/60 dark:text-white/60">{t.establishingP2P}</p>
        {role === 'host' && (
          <div className="mt-10 p-6 bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-[32px] border border-gray-200 dark:border-white/10 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Link2 className="w-5 h-5 text-brand-neon" />
              <span className="font-bold text-brand-dark dark:text-white/90 text-sm">{t.shareLinkPrompt}</span>
            </div>
            <div className="bg-gray-50 dark:bg-bg-dark-950 rounded-[20px] p-4 mb-4 border border-gray-200 dark:border-white/5 cursor-pointer" onClick={handleCopyLink}>
              <p className="text-xs font-mono text-brand-muted dark:text-brand-neon break-all text-left" dir="ltr">{getInviteLink()}</p>
            </div>
            <button onClick={handleCopyLink} className={`w-full py-4 rounded-[20px] font-bold flex justify-center items-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-lg shadow-brand-neon/20'}`}>
              {copied ? t.linkCopied : t.copyRoomLinkBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] flex flex-col bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      {showInviteModal && renderInviteModal()}
      <div className="bg-white/80 dark:bg-white/5 backdrop-blur-2xl border-b border-gray-200 dark:border-white/10 px-4 py-4 flex flex-row items-center justify-between z-40 relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-gray-200 dark:border-white/10">
            <div className={`w-2 h-2 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_10px_#22C55E]' : 'bg-brand-neon'} animate-pulse`} />
            <span className="text-sm font-bold text-emerald-900/80 dark:text-white/80">{participants.length} {t.onlineCount}</span>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-neon/10 hover:bg-brand-neon/20 border border-brand-neon/20 text-brand-muted dark:text-brand-neon text-sm font-bold rounded-2xl transition-all">
            <UserPlus className="w-4 h-4" /> {t.inviteBtn}
          </button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
          <MicStatusIndicator isRecording={isMicOn} volume={0} processingStatus={processingStatus} />
        </div>
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-white/5 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10">
          <span className="text-xs sm:text-sm font-bold text-brand-dark dark:text-white/90">{getLanguageName(myLanguage)}</span>
          <ArrowRight className={`w-4 h-4 text-brand-neon ${isRtl ? 'scale-x-[-1]' : ''}`} />
          <span className="text-xs sm:text-sm font-bold text-brand-dark dark:text-white/90">{getLanguageName(partnerLanguage)}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative p-4 gap-4 bg-gray-50 dark:bg-bg-dark-950">
        <div className="min-h-0 rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-bg-dark-900 flex-1"><VideoGrid /></div>
        {sidePanelOpen && (
          <div className={`fixed ${isRtl ? 'left-4' : 'right-4'} top-24 bottom-24 lg:static lg:w-[400px] lg:h-full rounded-[32px] overflow-hidden bg-white/95 dark:bg-bg-dark-900/95 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col z-50 shrink-0`}>
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
      <MeetingControls roomId={roomId} onEndCall={handleEndCall} onToggleMic={handleToggleMic} onToggleCamera={handleToggleCamera} onStartScreenShare={peerStartScreenShare} onStopScreenShare={peerStopScreenShare} />
    </div>
  );

  return (
    <>
      <audio ref={ttsAudioRef} id="tts-audio-player" playsInline style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', left: -9999 }} />
      {phase === 'setup' ? renderSetup() : phase === 'connecting' ? renderConnecting() : renderActive()}
    </>
  );
}
