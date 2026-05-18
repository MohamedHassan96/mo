import { useState, useCallback, useEffect, useRef, useMemo, Component, ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useSpeechToText } from '@/app-hooks/useSpeechToText';
import { useRealtimeTranslation } from '@/app-hooks/useRealtimeTranslation';
import { usePeerConnection } from '@/app-hooks/usePeerConnection';
import { useSocketRoom } from '@/app-hooks/useSocketRoom';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { detectBrowserLanguage, getLanguageName } from '@/config/languages';
import LanguageSelector from '@/ui/LanguageSelector';
import VideoGrid from '@/ui/VideoGrid';
import SidePanel from '@/ui/SidePanel';
import MeetingControls from '@/ui/MeetingControls';
import MicStatusIndicator from '@/ui/MicStatusIndicator';
import {
  Mic, MicOff, Video, VideoOff, Copy, Check, UserPlus, Radio, ArrowRight,
  Link2, Share2, Users, X, Zap, Sparkles, SlidersHorizontal, RefreshCw, AlertTriangle
} from 'lucide-react';
import type { ParticipantRole, ChatMessage, Participant, TranscriptEntry } from '@/types';
import { playJoinSound, playMessageSound } from '@/utils/sounds';

// ─── Error Boundary ───────────────────────────────────────────────
class RoomErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-black text-white">System Error</h1>
          <pre className="text-[10px] text-red-400 mt-4 bg-white/5 p-4 rounded-xl border border-white/10 max-w-md overflow-auto">{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} className="mt-8 px-8 py-3 bg-brand-neon text-brand-dark rounded-xl font-black">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RoomPageProps { roomId: string; role: ParticipantRole; onLeave: () => void; }
type RoomPhase = 'setup' | 'connecting' | 'active';
type CameraResolution = '480p' | '720p' | '1080p';
type CameraFit = 'cover' | 'contain';

interface CameraSettings {
  deviceId: string;
  resolution: CameraResolution;
  frameRate: number;
  mirror: boolean;
  fit: CameraFit;
}

const CAMERA_RESOLUTIONS: Record<CameraResolution, { label: string; width: number; height: number }> = {
  '480p': { label: '480p', width: 854, height: 480 },
  '720p': { label: '720p HD', width: 1280, height: 720 },
  '1080p': { label: '1080p Full HD', width: 1920, height: 1080 },
};

const FRAME_RATE_OPTIONS = [15, 24, 30, 60];

function RoomPageContent({ roomId, role, onLeave }: RoomPageProps) {
  const { uiLanguage, config } = useConfigStore();
  const t = getTranslations(uiLanguage);
  const isRtl = ['ar', 'fa', 'ur'].includes(uiLanguage);
  const { elevenLabsVoiceId } = config;

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
  const [enableMic, setEnableMic] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [customRoomId, setCustomRoomId] = useState(roomId);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    deviceId: '',
    resolution: '720p',
    frameRate: 30,
    mirror: true,
    fit: 'cover',
  });
  const cameraSettingsRef = useRef(cameraSettings);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const myLanguageRef = useRef(myLanguage);
  useEffect(() => { myLanguageRef.current = myLanguage; }, [myLanguage]);

  useEffect(() => { cameraSettingsRef.current = cameraSettings; }, [cameraSettings]);

  const participantIdRef = useRef(participantId);
  useEffect(() => { participantIdRef.current = participantId; }, [participantId]);

  const isListeningRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<((stream?: MediaStream | null) => void) | null>(null);
  const shouldListenRef = useRef(false);

  const { processRecognizedText, cancelPendingTranslation } = useRealtimeTranslation();
  const {
    processingStatus, sidePanelOpen, participants,
    isMicOn, isCameraOn: isCameraOnStore, audioPlaybackEnabled,
    setMicOn, setCameraOn, addParticipant, updateParticipant,
    removeParticipant,
    addChatMessage, setMyId: setStoreMyId,
    setProcessingStatus, createRoom, leaveRoom, setLocalStream: setStoreLocalStream,
    setRemoteStream, addTranscript, updateTranscript
  } = useRoomStore();

  const createVideoOnlyStream = useCallback((stream: MediaStream | null) => (
    new MediaStream(stream?.getVideoTracks() ?? [])
  ), []);

  const syncLocalStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStreamState(stream);
    setStoreLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
  }, [setStoreLocalStream]);

  const handleRemoteStream = useCallback((stream: MediaStream, _peerId?: string) => {
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      // PURE TRANSLATION MODE: Keep raw remote audio muted so users only hear the AI translation
      remoteAudioRef.current.muted = true;
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

  const handleTranscriptReceived = useCallback(async (transcript: TranscriptEntry) => {
    addTranscript(transcript);
  }, [addTranscript]);

  const handleTranslatedAudio = useCallback((data: {
    originalId: string;
    speakerId?: string;
    speakerName: string;
    speakerRole?: ParticipantRole;
    originalText: string;
    originalLanguage?: string;
    translatedText: string;
    translatedLanguage: string;
    audioBase64: string;
    playAudio?: boolean;
  }) => {
    if (!data.translatedText?.trim()) return;
    const existing = useRoomStore.getState().transcripts.some((entry) => entry.id === data.originalId);
    if (existing) {
      updateTranscript(data.originalId, {
        translatedText: data.translatedText,
        translatedLanguage: data.translatedLanguage,
      });
    } else {
      addTranscript({
        id: data.originalId,
        speakerId: data.speakerId || data.originalId,
        speakerName: data.speakerName,
        speakerRole: data.speakerRole || 'guest',
        originalText: data.originalText,
        originalLanguage: data.originalLanguage || data.translatedLanguage,
        translatedText: data.translatedText,
        translatedLanguage: data.translatedLanguage,
        timestamp: Date.now(),
      });
    }

    if (data.playAudio === false) return;
    setProcessingStatus({ stage: 'synthesizing', message: t.synthesizingStatus(data.speakerName) });
    
    const afterPlay = () => {
      if (shouldListenRef.current) {
        console.log('[TTS] Playback ended, resuming mic...');
        startListeningRef.current?.(localStreamRef.current); // Resume STT
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
      } else {
        setProcessingStatus({ stage: 'idle', message: '' });
      }
    };

    if (!audioPlaybackEnabled) {
      afterPlay();
      return;
    }

    const config = useConfigStore.getState().config;
    const isBrowserTTS = config.ttsProvider === 'browser' || !data.audioBase64;

    if (isBrowserTTS) {
      console.log('[TTS] Using browser SpeechSynthesis for:', data.translatedText);
      
      // AUTO-PAUSE MIC: Stop STT while speaking to prevent feedback
      if (isListeningRef.current) {
        console.log('[TTS] Playback starting (browser), pausing mic...');
        stopListeningRef.current?.();
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.translatedText);
        utterance.lang = data.translatedLanguage === 'ar' ? 'ar-EG' : data.translatedLanguage;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => 
          v.lang.includes(utterance.lang) || v.lang.startsWith(data.translatedLanguage)
        );
        if (matchingVoice) utterance.voice = matchingVoice;

        utterance.onend = afterPlay;
        utterance.onerror = () => afterPlay();
        window.speechSynthesis.speak(utterance);
      } else {
        console.warn('[TTS] Browser SpeechSynthesis not supported');
        afterPlay();
      }
      return;
    }

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
  }, [addTranscript, audioPlaybackEnabled, updateTranscript, setProcessingStatus, t]);

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
      elevenLabsVoiceId: config.elevenLabsVoiceId
    },
    enabled: phase !== 'setup',
    onChatMessage: handleChatMessage,
    onTranscriptReceived: handleTranscriptReceived,
    onTranslatedAudio: handleTranslatedAudio
  });

  const {
    isReady: isPeerReady,
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
    onParticipantLeft: (peerId) => {
      const participant = participants.find((p) => p.peerId === peerId);
      if (participant) removeParticipant(participant.id);
    },
    onConnectionChange: handleConnectionChange,
    onPeerConnected: () => { },
    onTranscriptReceived: handleTranscriptReceived,
  });

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      setCameraDevices(videoInputs);
      setCameraSettings((current) => {
        if (current.deviceId && videoInputs.some((device) => device.deviceId === current.deviceId)) {
          return current;
        }
        return { ...current, deviceId: videoInputs[0]?.deviceId ?? '' };
      });
    } catch (err) {
      console.warn('Failed to enumerate camera devices:', err);
    }
  }, []);

  useEffect(() => {
    refreshCameraDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameraDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshCameraDevices);
    };
  }, [refreshCameraDevices]);

  const getVideoConstraints = useCallback((settings: CameraSettings): MediaTrackConstraints => {
    const resolution = CAMERA_RESOLUTIONS[settings.resolution];
    return {
      width: { ideal: resolution.width },
      height: { ideal: resolution.height },
      frameRate: { ideal: settings.frameRate, max: settings.frameRate },
      ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : { facingMode: 'user' }),
    };
  }, []);

  const broadcastCameraState = useCallback((isOn: boolean) => {
    if (phase === 'setup') return;
    const updates = { isCameraOn: isOn };
    updateParticipant(participantId, updates);
    socketUpdateParticipant(updates);
    peerSendData({ type: 'participant-update', payload: { id: participantId, ...updates } as Participant });
  }, [participantId, peerSendData, phase, socketUpdateParticipant, updateParticipant]);

  const startCameraWithSettings = useCallback(async (settings: CameraSettings) => {
    try {
      setCameraError('');
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(settings),
        audio: false,
      });
      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No camera video track was returned');

      const currentStream = localStreamRef.current;
      currentStream?.getVideoTracks().forEach((track) => {
        track.stop();
        currentStream.removeTrack(track);
      });

      const nextLocalStream = new MediaStream([
        ...(currentStream?.getAudioTracks() ?? []),
        videoTrack,
      ]);

      const actualSettings = videoTrack.getSettings();
      if (actualSettings.deviceId && actualSettings.deviceId !== settings.deviceId) {
        setCameraSettings((current) => ({ ...current, deviceId: actualSettings.deviceId || current.deviceId }));
      }

      syncLocalStream(nextLocalStream);
      setPeerLocalStream(new MediaStream([videoTrack]));
      peerReplaceVideoTrack(videoTrack);
      setEnableCamera(true);
      setCameraOn(true);
      broadcastCameraState(true);
      refreshCameraDevices();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      console.error('Failed to start camera:', err);
      setCameraError(message);
      setEnableCamera(false);
      setCameraOn(false);
      broadcastCameraState(false);
      return false;
    }
  }, [
    broadcastCameraState,
    getVideoConstraints,
    peerReplaceVideoTrack,
    refreshCameraDevices,
    setCameraOn,
    setPeerLocalStream,
    syncLocalStream,
  ]);

  const stopLocalCamera = useCallback(() => {
    const currentStream = localStreamRef.current;
    currentStream?.getVideoTracks().forEach((track) => {
      track.stop();
      currentStream.removeTrack(track);
    });

    const audioTracks = currentStream?.getAudioTracks() ?? [];
    syncLocalStream(audioTracks.length > 0 ? new MediaStream(audioTracks) : null);
    setPeerLocalStream(new MediaStream());
    peerReplaceVideoTrack(null);
    setEnableCamera(false);
    setCameraOn(false);
    setCameraError('');
    broadcastCameraState(false);
  }, [broadcastCameraState, peerReplaceVideoTrack, setCameraOn, setPeerLocalStream, syncLocalStream]);

  const updateCameraSetting = useCallback((key: keyof CameraSettings, value: string | number | boolean) => {
    const nextSettings = { ...cameraSettingsRef.current, [key]: value } as CameraSettings;
    cameraSettingsRef.current = nextSettings;
    setCameraSettings(nextSettings);
    if ((key === 'deviceId' || key === 'resolution' || key === 'frameRate') && (enableCamera || isCameraOnStore)) {
      startCameraWithSettings(nextSettings);
    }
  }, [enableCamera, isCameraOnStore, startCameraWithSettings]);

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
    if (!shouldListenRef.current) {
      cancelPendingTranslation();
      return;
    }

    processRecognizedText(text, isFinal, {
      speakerId: participantId, speakerName: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage,
    }, async (entry) => {
      socketSendTranscript(entry);
      peerSendData({ type: 'transcript', payload: entry });
    });
  }, [cancelPendingTranslation, processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, socketSendTranscript, peerSendData, t]);

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
      shouldListenRef.current = false;
      cancelPendingTranslation();
      stopListening();
      socketDisconnect();
      peerDisconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      leaveRoom();
    };
  }, []);

  useEffect(() => {
    if (phase === 'connecting' && isPeerReady && role === 'guest' && localStream) {
      connectToHost(createVideoOnlyStream(localStream));
    }
  }, [phase, isPeerReady, role, connectToHost, localStream, createVideoOnlyStream]);

  useEffect(() => {
    if (phase === 'setup' || !isPeerReady || !localStream) return;
    const outboundStream = createVideoOnlyStream(localStream);
    participants
      .map((p) => p.peerId)
      .filter((peerId): peerId is string => Boolean(peerId && peerId !== myPeerId))
      .forEach((peerId) => {
        connectToPeer(peerId, outboundStream);
      });
  }, [phase, isPeerReady, localStream, participants, myPeerId, connectToPeer, createVideoOnlyStream]);

  const getMediaStream = useCallback(async () => {
    const currentStream = localStreamRef.current;
    currentStream?.getAudioTracks().forEach((track) => {
      track.stop();
      currentStream.removeTrack(track);
    });

    let audioTracks: MediaStreamTrack[] = [];
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      audioTracks = audioStream.getAudioTracks();
    } catch {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
        audioTracks = audioStream.getAudioTracks();
      } catch {
        if (enableMic) return null;
      }
    }

    audioTracks.forEach((track) => { track.enabled = enableMic; });

    let videoTrack = currentStream?.getVideoTracks().find((track) => track.readyState === 'live') ?? null;
    if (enableCamera && !videoTrack) {
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: getVideoConstraints(cameraSettingsRef.current),
          audio: false,
        });
        videoTrack = cameraStream.getVideoTracks()[0] ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to access camera';
        setCameraError(message);
        setEnableCamera(false);
        setCameraOn(false);
      }
    }

    const tracks = [...audioTracks, ...(videoTrack ? [videoTrack] : [])];
    const stream = tracks.length > 0 ? new MediaStream(tracks) : null;
    syncLocalStream(stream);
    return stream;
  }, [enableMic, enableCamera, getVideoConstraints, setCameraOn, syncLocalStream]);

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
      elevenLabsVoiceId: config.elevenLabsVoiceId
    };
    addParticipant(myParticipant);
    setMicOn(enableMic);
    setCameraOn(enableCamera);
    const stream = await getMediaStream();
    const actualCameraOn = Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
    setEnableCamera(actualCameraOn);
    setCameraOn(actualCameraOn);
    updateParticipant(participantId, { isCameraOn: actualCameraOn });
    if (stream) {
      // Ensure tracks match the intended state
      stream.getAudioTracks().forEach(track => {
        track.enabled = enableMic;
      });

      // PURE AI BRIDGE: Only send Video tracks to peers. 
      // Do NOT send Audio tracks via PeerConnection to ensure only translated audio is heard.
      const videoOnlyStream = createVideoOnlyStream(stream);
      setPeerLocalStream(videoOnlyStream);

      if (enableMic && isSupported) {
        setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
        shouldListenRef.current = true;
        if (role === 'host') {
          startListening(stream);
          setMicOn(true);
        } else {
          setTimeout(() => {
            startListening(stream);
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
    setTimeout(() => setPhase('active'), role === 'host' ? 0 : 2000);
  }, [participantId, myPeerId, name, role, myLanguage, partnerLanguage, enableMic, enableCamera, addParticipant, getMediaStream, createVideoOnlyStream, setPeerLocalStream, isSupported, startListening, setMicOn, setCameraOn, updateParticipant, setProcessingStatus, t, customRoomId, roomId]);

  const handleToggleMic = useCallback(() => {
    const nextState = !isMicOn;

    // We keep the local track enabled for STT processing only.
    // We do NOT send it to peers (Pure AI Bridge).
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = nextState; });
    }

    if (nextState) {
      shouldListenRef.current = true;
      startListening(localStreamRef.current);
      setProcessingStatus({ stage: 'listening', message: t.listeningStatus });
    } else {
      shouldListenRef.current = false;
      cancelPendingTranslation();
      stopListening();
      setProcessingStatus({ stage: 'idle', message: '' });
    }

    setMicOn(nextState);
    const updates = { isMicOn: nextState };
    updateParticipant(participantId, updates);
    socketUpdateParticipant(updates);

    // IMPORTANT: Only send data updates, never send the raw audio track.
    peerSendData({ type: 'participant-update', payload: { id: participantId, ...updates } as Participant });
  }, [isMicOn, startListening, stopListening, cancelPendingTranslation, setMicOn, setProcessingStatus, updateParticipant, participantId, socketUpdateParticipant, peerSendData, t]);

  const handleToggleCamera = useCallback(async () => {
    const wasOn = enableCamera || isCameraOnStore;
    const nextOn = !wasOn;

    if (nextOn) {
      await startCameraWithSettings(cameraSettingsRef.current);
    } else {
      stopLocalCamera();
    }
  }, [enableCamera, isCameraOnStore, startCameraWithSettings, stopLocalCamera]);

  const handleEndCall = useCallback(() => {
    shouldListenRef.current = false;
    cancelPendingTranslation();
    stopListening();
    socketDisconnect();
    peerDisconnect();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setMicOn(false);
    setCameraOn(false);
    setEnableCamera(false);
    onLeave();
  }, [cancelPendingTranslation, stopListening, socketDisconnect, peerDisconnect, setMicOn, setCameraOn, onLeave]);

  const renderCameraControls = (variant: 'setup' | 'active') => {
    const selectClass = "w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark-950 px-3 py-2.5 text-xs font-bold text-brand-dark dark:text-white/90 outline-none focus:border-brand-neon";
    const panelClass = variant === 'setup'
      ? "mt-4 rounded-[28px] border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-bg-dark-950/80 p-4 shadow-lg"
      : "absolute top-4 left-4 right-4 sm:left-auto sm:w-[360px] z-30 rounded-[28px] border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-bg-dark-950/95 p-4 shadow-2xl backdrop-blur-2xl";

    return (
      <div className={panelClass} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-brand-neon" />
            <span className="text-sm font-black text-brand-dark dark:text-white/95">إعدادات الكاميرا</span>
          </div>
          <button
            type="button"
            onClick={refreshCameraDevices}
            className="w-9 h-9 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-brand-muted dark:text-brand-neon flex items-center justify-center"
            title="تحديث الكاميرات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[10px] font-black text-emerald-900/50 dark:text-white/40">الكاميرا</span>
            <select
              value={cameraSettings.deviceId}
              onChange={(event) => updateCameraSetting('deviceId', event.target.value)}
              className={selectClass}
            >
              {cameraDevices.length === 0 ? (
                <option value="">Default camera</option>
              ) : (
                cameraDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-black text-emerald-900/50 dark:text-white/40">الدقة</span>
            <select
              value={cameraSettings.resolution}
              onChange={(event) => updateCameraSetting('resolution', event.target.value as CameraResolution)}
              className={selectClass}
            >
              {Object.entries(CAMERA_RESOLUTIONS).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-black text-emerald-900/50 dark:text-white/40">FPS</span>
            <select
              value={cameraSettings.frameRate}
              onChange={(event) => updateCameraSetting('frameRate', Number(event.target.value))}
              className={selectClass}
            >
              {FRAME_RATE_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>{fps}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateCameraSetting('mirror', !cameraSettings.mirror)}
            className={`px-3 py-2.5 rounded-2xl text-xs font-black border transition-all ${cameraSettings.mirror
                ? 'bg-brand-neon text-brand-dark border-brand-neon'
                : 'bg-gray-50 dark:bg-white/5 text-emerald-900/60 dark:text-white/50 border-gray-200 dark:border-white/10'
              }`}
          >
            مرآة
          </button>
          <button
            type="button"
            onClick={() => updateCameraSetting('fit', cameraSettings.fit === 'cover' ? 'contain' : 'cover')}
            className="px-3 py-2.5 rounded-2xl text-xs font-black border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-brand-dark dark:text-white/80"
          >
            {cameraSettings.fit === 'cover' ? 'ملء الإطار' : 'إظهار كامل'}
          </button>
        </div>

        {cameraError && (
          <p className="mt-3 text-xs font-bold text-red-500">{cameraError}</p>
        )}
      </div>
    );
  };

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
          <button onClick={handleCopyRoomCode} className={`w-full py-5 rounded-[22px] font-black flex items-center justify-center gap-3 transition-all ${copiedRoomCode ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-xl'}`}>
            {copiedRoomCode ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomCodeBtn}</>}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex items-center justify-center p-3 sm:p-4 bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-neon/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-3 sm:gap-6 animate-fade-up">
        <div className="order-2 lg:order-1 lg:col-span-7 rounded-[32px] sm:rounded-[40px] bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden relative aspect-video flex items-center justify-center">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 w-full h-full bg-black ${cameraSettings.fit === 'cover' ? 'object-cover' : 'object-contain'} ${cameraSettings.mirror ? 'transform scale-x-[-1]' : ''} ${enableCamera ? 'opacity-100' : 'opacity-0'}`}
          />
          {!enableCamera && (
            <div className="w-32 h-32 rounded-[40px] bg-white dark:bg-bg-dark-900 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-2xl relative">
              <span className="text-6xl font-black text-brand-neon">{(name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)).charAt(0)}</span>
            </div>
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/5 dark:bg-black/40 backdrop-blur-xl p-2.5 rounded-[28px] border border-black/5 dark:border-white/10 shadow-lg dark:shadow-none">
            <button
              onClick={() => setEnableMic(!enableMic)}
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-sm ${enableMic
                  ? 'bg-white dark:bg-white/10 text-brand-dark dark:text-white hover:bg-gray-50'
                  : 'bg-red-500 text-white shadow-red-500/20'
                }`}
            >
              {enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={handleToggleCamera}
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-sm ${enableCamera
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LanguageSelector value={myLanguage} onChange={setMyLanguage} label={t.myLanguageLabel} />
              <LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label={t.partnerLanguageLabel} />
            </div>
            {renderCameraControls('setup')}
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
          <button onClick={() => setShowCameraControls((open) => !open)} className={`flex items-center gap-2 px-4 py-2 border text-sm font-bold rounded-2xl transition-all ${showCameraControls
              ? 'bg-brand-neon text-brand-dark border-brand-neon'
              : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-brand-muted dark:text-white/70 hover:text-brand-dark dark:hover:text-white/95'
            }`}>
            <SlidersHorizontal className="w-4 h-4" /> <span className="hidden sm:inline">الكاميرا</span>
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
        <div className="min-h-0 rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-bg-dark-900 flex-1">
          <VideoGrid localMirror={cameraSettings.mirror} localFit={cameraSettings.fit} />
          {showCameraControls && renderCameraControls('active')}
        </div>
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

export default function RoomPage2(props: RoomPageProps) { return <RoomErrorBoundary><RoomPageContent {...props} /></RoomErrorBoundary>; }
