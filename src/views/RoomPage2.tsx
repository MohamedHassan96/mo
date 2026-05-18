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
  X, Zap, Activity, AlertTriangle, Volume2, Users, Link2, Share2
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
          <h1 className="text-2xl font-bold text-red-900 mb-2">حدث خطأ في تحميل الغرفة</h1>
          <pre className="text-xs text-red-700 mb-4 max-w-md bg-white p-4 rounded-xl border border-red-200 overflow-auto">{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">إعادة المحاولة</button>
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
      ttsAudioRef.current.play().then(() => { ttsAudioRef.current?.pause(); }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const h = () => { unlockAudio(); window.removeEventListener('click', h); window.removeEventListener('touchstart', h); };
    window.addEventListener('click', h); window.addEventListener('touchstart', h);
    return () => { window.removeEventListener('click', h); window.removeEventListener('touchstart', h); };
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
    onChatMessage: (m) => addChatMessage(m), onTranscriptReceived: (tr) => useRoomStore.getState().addTranscript(tr), onTranslatedAudio: handleTranslatedAudio
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
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, sendTranscript]);

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

  const renderInviteModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowInviteModal(false)}>
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0a1622] border border-white/10 rounded-[32px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-neon/20 flex items-center justify-center"><Users className="w-6 h-6 text-brand-neon" /></div>
            <div><h3 className="text-xl font-black dark:text-white">{t.inviteModalTitle}</h3><p className="text-sm dark:text-white/60 font-medium">{participants.length} {t.inviteModalActive}</p></div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-white/40" /></button>
        </div>
        <div className="space-y-6">
          <div className="bg-black/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4" onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }}>
            <p className="text-sm font-mono dark:text-white/80 break-all select-all text-left" dir="ltr">{`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`}</p>
            <Copy className="w-5 h-5 text-brand-neon shrink-0" />
          </div>
          <button onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }} className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-lg shadow-brand-neon/20'}`}>
            {copied ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomLinkBtn}</>}
          </button>
        </div>
      </div>
    </div>
  );

  if (phase === 'setup') return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-3 bg-gray-50 dark:bg-[#010b13] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-6 animate-fade-up">
        <div className="lg:col-span-7 rounded-[32px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden relative aspect-video flex items-center justify-center">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />
          {!enableCamera && <div className="w-32 h-32 rounded-[40px] bg-white dark:bg-bg-dark-900 border border-white/10 flex items-center justify-center shadow-2xl relative"><span className="text-6xl font-black text-brand-neon">{(name || 'U')[0]}</span></div>}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 backdrop-blur-xl p-2.5 rounded-[28px] border border-white/10">
            <button onClick={() => setEnableMic(!enableMic)} className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all ${enableMic ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>{enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}</button>
            <button onClick={() => setEnableCamera(!enableCamera)} className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all ${enableCamera ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>{enableCamera ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}</button>
          </div>
        </div>
        <div className="lg:col-span-5 rounded-[32px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-xl p-8 flex flex-col justify-center space-y-6">
          <div className="text-center"><h2 className="text-2xl font-black dark:text-white">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h2><p className="dark:text-white/60 mt-2 text-sm">{t.roomSetupDesc}</p></div>
          <div className="space-y-4">
            <div className="space-y-1"><label className="text-sm font-bold dark:text-white/70 px-1">{t.roomCodeLabel}</label><input type="text" value={customRoomId} onChange={(e) => setCustomRoomId(e.target.value.toLowerCase())} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 dark:text-white outline-none font-bold" /></div>
            <div className="space-y-1"><label className="text-sm font-bold dark:text-white/70 px-1">{t.nameLabel}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 dark:text-white outline-none font-bold" /></div>
            <div className="grid grid-cols-2 gap-4"><LanguageSelector value={myLanguage} onChange={setMyLanguage} label="My Language" /><LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label="Partner Language" /></div>
          </div>
          <button onClick={handleStartSession} className="w-full py-5 bg-brand-neon text-brand-dark rounded-[24px] text-lg font-black shadow-lg shadow-brand-neon/20 hover:scale-[1.02] transition-transform">START MEETING</button>
        </div>
      </div>
    </div>
  );

  if (phase === 'connecting') return <div className="min-h-screen flex items-center justify-center bg-[#010b13]"><Activity className="w-12 h-12 text-brand-neon animate-pulse" /></div>;

  return (
    <div className="h-screen max-h-screen flex flex-col bg-gray-50 dark:bg-[#010b13] overflow-hidden fixed inset-0" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={ttsAudioRef} playsInline crossOrigin="anonymous" style={{ display: 'none' }} />
      {showInviteModal && renderInviteModal()}

      {/* Room Header */}
      <div className="bg-white/80 dark:bg-white/5 backdrop-blur-2xl border-b border-gray-200 dark:border-white/10 px-4 py-2.5 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_8px_#22C55E]' : 'bg-brand-neon'} animate-pulse`} />
            <span className="text-[10px] font-black dark:text-white/80">{participants.length} {t.onlineCount}</span>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-brand-neon/10 hover:bg-brand-neon/20 border border-brand-neon/20 text-brand-neon text-[10px] font-black rounded-xl transition-all"><UserPlus className="w-3.5 h-3.5" /> {t.inviteBtn}</button>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10">
          <span className="text-[9px] font-black dark:text-white/90 uppercase">{getLanguageName(myLanguage)}</span>
          <ArrowRight className={`w-3 h-3 text-brand-neon ${isRtl ? 'scale-x-[-1]' : ''}`} />
          <span className="text-[9px] font-black dark:text-white/90 uppercase">{getLanguageName(partnerLanguage)}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 gap-3 min-h-0">
        <div className="flex-1 min-h-0 rounded-[20px] sm:rounded-[28px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-black/40 shadow-xl"><VideoGrid /></div>
        <div className="h-[40%] lg:h-full lg:w-[380px] rounded-[20px] sm:rounded-[28px] overflow-hidden bg-white dark:bg-bg-dark-900 border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col shrink-0"><SidePanel myId={participantId} myName={name || 'User'} myRole={role} myLanguage={myLanguage} partnerLanguage={partnerLanguage} onSendMessage={(m) => sendChatMessage(m)} /></div>
      </div>
      <div className="shrink-0">
        <MeetingControls roomId={roomId} onEndCall={() => onLeave()} onToggleMic={handleToggleMic} onToggleCamera={handleToggleCamera} />
      </div>
    </div>
  );
}
}

export default function RoomPage2(props: RoomPageProps) { return <RoomErrorBoundary><RoomPageContent {...props} /></RoomErrorBoundary>; }
