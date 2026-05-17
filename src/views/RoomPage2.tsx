import { useState, useCallback, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
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
import {
  Mic, MicOff, Video, VideoOff, Copy, Check, UserPlus, Radio, ArrowRight,
  X, Zap, Activity, AlertTriangle, Volume2
} from 'lucide-react';
import type { ParticipantRole, ChatMessage, Participant, TranscriptEntry } from '@/types';

// ─── Error Boundary ───────────────────────────────────────────────
class RoomErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Error Loading Room</h1>
          <pre className="text-xs text-red-700 mb-4 max-w-md bg-white p-4 rounded-xl border border-red-200">{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold shadow-lg">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RoomPageProps { roomId: string; role: ParticipantRole; onLeave: () => void; }
type RoomPhase = 'setup' | 'connecting' | 'active';

function RoomPageContent({ roomId, role, onLeave }: RoomPageProps) {
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);
  const isRtl = ['ar', 'fa', 'ur'].includes(uiLanguage);

  const [phase, setPhase] = useState<RoomPhase>('setup');
  const [name, setName] = useState('');
  const [myLanguage, setMyLanguage] = useState(role === 'host' ? detectBrowserLanguage() : 'en');
  const [partnerLanguage, setPartnerLanguage] = useState(role === 'host' ? 'en' : 'ar');
  const [copied, setCopied] = useState(false);
  const [participantId] = useState(() => uuid());
  const normalizedRoomId = roomId.trim().toLowerCase();
  const myPeerId = useMemo(() => role === 'host' ? normalizedRoomId : `guest-${uuid().slice(0, 8)}`, [role, normalizedRoomId]);

  const [enableCamera, setEnableCamera] = useState(false);
  const [enableMic, setEnableMic] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [customRoomId, setCustomRoomId] = useState(roomId);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const isListeningRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const shouldListenRef = useRef(false);

  const { processRecognizedText } = useRealtimeTranslation();
  const {
    participants, isMicOn, isCameraOn: isCameraOnStore, localStream,
    setMicOn, setCameraOn, addParticipant, updateParticipant, removeParticipant,
    addChatMessage, setMyId, setProcessingStatus, createRoom, leaveRoom, setRemoteStream
  } = useRoomStore();

  const { startCamera, stopCamera, startAudio } = useMediaDevices();

  // ─── SILENT AUDIO UNLOCK ───────────────────────────────────────
  const unlockAudio = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.play().then(() => { ttsAudioRef.current?.pause(); console.log('🔊 Audio Unlocked'); }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => { unlockAudio(); window.removeEventListener('click', handleInteraction); window.removeEventListener('touchstart', handleInteraction); };
    window.addEventListener('click', handleInteraction); window.addEventListener('touchstart', handleInteraction);
    return () => { window.removeEventListener('click', handleInteraction); window.removeEventListener('touchstart', handleInteraction); };
  }, [unlockAudio]);

  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = localStream; }, [localStream]);

  const handleTranslatedAudio = useCallback((data: any) => {
    useRoomStore.getState().updateTranscript(data.originalId, { translatedText: data.translatedText, translatedLanguage: data.translatedLanguage });
    if (!data.audioBase64) return;
    setProcessingStatus({ stage: 'synthesizing', message: t.synthesizingStatus?.(data.speakerName) });
    const afterPlay = () => {
      if (shouldListenRef.current) { startListeningRef.current?.(); setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); }
      else setProcessingStatus({ stage: 'idle', message: '' });
    };
    const audio = ttsAudioRef.current;
    if (audio) {
      if (isListeningRef.current) stopListeningRef.current?.();
      audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
      audio.onended = afterPlay; audio.onerror = afterPlay;
      audio.play().catch(afterPlay);
    }
  }, [setProcessingStatus, t]);

  const { sendChatMessage, sendTranscript, disconnect: socketDisconnect } = useSocketRoom({
    roomId: normalizedRoomId,
    participant: { id: participantId, peerId: myPeerId, name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder), role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera, isScreenSharing: false, isConnected: true },
    enabled: phase !== 'setup',
    onChatMessage: (m) => addChatMessage(m), onTranscriptReceived: (t) => useRoomStore.getState().addTranscript(t), onTranslatedAudio: handleTranslatedAudio
  });

  const { disconnect: peerDisconnect, replaceVideoTrack } = usePeerConnection({
    roomId: normalizedRoomId, isHost: role === 'host', myId: myPeerId, hostId: normalizedRoomId,
    enabled: phase !== 'setup',
    onRemoteStream: (s) => setRemoteStream(s), onChatMessage: (m) => addChatMessage(m),
    onParticipantUpdate: (p) => updateParticipant(p.id, p),
    onParticipantLeft: (pid) => removeParticipant(pid),
    onTranscriptReceived: (tr) => useRoomStore.getState().addTranscript(tr),
  });

  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    processRecognizedText(text, isFinal, { speakerId: participantId, speakerName: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder), speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage }, (entry) => {
      sendTranscript(entry);
    });
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, sendTranscript, t]);

  const { isListening, isSupported, startListening, stopListening } = useSpeechToText({ language: myLanguage, onResult: handleSpeechResult });

  useEffect(() => { isListeningRef.current = isListening; stopListeningRef.current = stopListening; startListeningRef.current = startListening; }, [isListening, stopListening, startListening]);

  useEffect(() => {
    setMyId(participantId); if (role === 'host') createRoom(normalizedRoomId, participantId);
    return () => { stopListening(); socketDisconnect(); peerDisconnect(); leaveRoom(); };
  }, []);

  const handleStartSession = useCallback(async () => {
    unlockAudio();
    if (customRoomId && customRoomId !== roomId) { window.location.hash = `/room/${customRoomId}`; return; }
    setPhase('connecting');
    addParticipant({ id: participantId, peerId: myPeerId, name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder), role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera, isScreenSharing: false, isConnected: true });
    setMicOn(enableMic); setCameraOn(enableCamera);
    await startAudio(); if (enableCamera) await startCamera();
    if (enableMic && isSupported) { setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); shouldListenRef.current = true; startListening(); }
    setTimeout(() => setPhase('active'), 1000);
  }, [participantId, name, role, myLanguage, enableMic, enableCamera, addParticipant, startAudio, startCamera, isSupported, startListening, setMicOn, setCameraOn, setProcessingStatus, t, customRoomId, roomId, myPeerId, unlockAudio]);

  const handleToggleMic = useCallback(() => {
    const next = !isMicOn;
    if (next) { shouldListenRef.current = true; startListening(); setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); }
    else { shouldListenRef.current = false; stopListening(); setProcessingStatus({ stage: 'idle', message: '' }); }
    setMicOn(next); setEnableMic(next); updateParticipant(participantId, { isMicOn: next });
  }, [isMicOn, startListening, stopListening, setMicOn, setProcessingStatus, updateParticipant, participantId, t]);

  const handleToggleCamera = useCallback(async () => {
    const next = !isCameraOnStore; setEnableCamera(next); setCameraOn(next);
    updateParticipant(participantId, { isCameraOn: next });
    if (next) { const s = await startCamera(); if (s) replaceVideoTrack(s.getVideoTracks()[0] || null); }
    else { stopCamera(); replaceVideoTrack(null); }
  }, [isCameraOnStore, setCameraOn, updateParticipant, participantId, startCamera, stopCamera, replaceVideoTrack]);

  if (phase === 'setup') return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-50 dark:bg-[#010b13]" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 bg-white dark:bg-white/5 p-6 rounded-[32px] shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center">
          <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />
          {!enableCamera && <div className="absolute inset-0 flex items-center justify-center"><div className="w-20 h-20 rounded-full bg-brand-neon flex items-center justify-center text-4xl font-black">{ (name || 'U')[0] }</div></div>}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3"><button onClick={() => setEnableMic(!enableMic)} className={`p-3 rounded-xl ${enableMic ? 'bg-white/20' : 'bg-red-500'}`}>{enableMic ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}</button><button onClick={() => setEnableCamera(!enableCamera)} className={`p-3 rounded-xl ${enableCamera ? 'bg-white/20' : 'bg-red-500'}`}>{enableCamera ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}</button></div>
        </div>
        <div className="flex flex-col justify-center space-y-4">
          <h2 className="text-2xl font-black">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h2>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} className="w-full px-5 py-3 rounded-xl bg-gray-100 dark:bg-black/40 border-none outline-none font-bold" />
          <div className="grid grid-cols-2 gap-3"><LanguageSelector value={myLanguage} onChange={setMyLanguage} label="Your Language" /><LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label="Partner Language" /></div>
          <button onClick={handleStartSession} className="w-full py-4 bg-brand-neon text-brand-dark rounded-xl font-black text-lg shadow-lg shadow-brand-neon/20 hover:scale-[1.02] transition-transform">START MEETING</button>
        </div>
      </div>
    </div>
  );

  if (phase === 'connecting') return <div className="min-h-screen flex items-center justify-center bg-[#010b13]"><Activity className="w-12 h-12 text-brand-neon animate-pulse" /></div>;

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-[#010b13] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={ttsAudioRef} playsInline style={{ display: 'none' }} />
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-4 gap-4">
        <div className="flex-1 min-h-0 rounded-[24px] sm:rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-black/40 shadow-xl"><VideoGrid /></div>
        <div className="lg:w-[400px] lg:h-full rounded-[24px] sm:rounded-[32px] overflow-hidden bg-white dark:bg-bg-dark-900 border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col shrink-0"><SidePanel myId={participantId} myName={name || 'User'} myRole={role} myLanguage={myLanguage} partnerLanguage={partnerLanguage} onSendMessage={(m) => sendChatMessage(m)} /></div>
      </div>
      <MeetingControls roomId={roomId} onEndCall={() => onLeave()} onToggleMic={handleToggleMic} onToggleCamera={handleToggleCamera} />
    </div>
  );
}

export default function RoomPage2(props: RoomPageProps) { return <RoomErrorBoundary><RoomPageContent {...props} /></RoomErrorBoundary>; }
