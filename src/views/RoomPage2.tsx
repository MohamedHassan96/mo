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
  X, Zap, Activity, AlertTriangle, Volume2, Users, Shield, Sparkles
} from 'lucide-react';
import type { ParticipantRole, ChatMessage, Participant, TranscriptEntry } from '@/types';

// ─── Error Boundary ───────────────────────────────────────────────
class RoomErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Internal Error</h1>
          <pre className="text-xs text-red-400 mb-8 max-w-md bg-white/5 p-4 rounded-2xl border border-white/10 overflow-auto">{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-black rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">Reload Application</button>
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
    participants, isMicOn, isCameraOn: isCameraOnStore, localStream, sidePanelOpen,
    setMicOn, setCameraOn, addParticipant, updateParticipant, removeParticipant,
    addChatMessage, setMyId, setProcessingStatus, createRoom, leaveRoom, setRemoteStream
  } = useRoomStore();

  const { startCamera, stopCamera, startAudio } = useMediaDevices();

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
    setTimeout(() => setPhase('active'), 1200);
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300" onClick={() => setShowInviteModal(false)}>
      <div className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 p-8 opacity-10"><Users className="w-32 h-32 text-white" /></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-neon/20 flex items-center justify-center border border-brand-neon/20"><Users className="w-7 h-7 text-brand-neon" /></div>
              <div><h3 className="text-xl font-black text-white">{t.inviteModalTitle}</h3><p className="text-sm text-white/50 font-bold">{participants.length} {t.inviteModalActive}</p></div>
            </div>
            <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-6 h-6 text-white/30" /></button>
          </div>
          <div className="space-y-6">
            <div className="bg-black/40 border border-white/5 rounded-[22px] p-6 flex items-center justify-between gap-4 group cursor-pointer hover:border-brand-neon/30 transition-all" onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }}>
              <p className="text-sm font-mono text-white/70 truncate select-all" dir="ltr">{`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`}</p>
              <Copy className={`w-5 h-5 shrink-0 transition-colors ${copied ? 'text-green-500' : 'text-brand-neon'}`} />
            </div>
            <button onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }} className={`w-full py-5 rounded-[22px] font-black flex items-center justify-center gap-3 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-xl shadow-brand-neon/20 hover:scale-[1.02]'}`}>
              {copied ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomLinkBtn}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (phase === 'setup') return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-4 bg-[#010b13] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-neon/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      
      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative aspect-video lg:aspect-square rounded-[40px] overflow-hidden bg-black/40 border border-white/10 shadow-2xl group flex items-center justify-center">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />
          {!enableCamera && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black"><div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center text-6xl font-black text-brand-neon shadow-2xl animate-pulse">{(name || 'U')[0]}</div></div>}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/40 backdrop-blur-2xl p-3 rounded-[30px] border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEnableMic(!enableMic)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${enableMic ? 'bg-white/10 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>{enableMic ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}</button>
            <button onClick={() => setEnableCamera(!enableCamera)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${enableCamera ? 'bg-white/10 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>{enableCamera ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}</button>
          </div>
        </div>
        
        <div className="flex flex-col space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-neon/10 border border-brand-neon/20 text-brand-neon text-xs font-black uppercase tracking-widest"><Shield className="w-3 h-3" /> Encrypted Session</div>
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h1>
            <p className="text-white/40 font-medium text-lg">{t.roomSetupDesc}</p>
          </div>
          <div className="space-y-5">
            <div className="space-y-2"><label className="text-xs font-black text-white/40 uppercase tracking-widest px-1">{t.nameLabel}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} className="w-full px-6 py-4 rounded-[24px] bg-white/5 border border-white/10 text-white text-lg font-bold outline-none focus:border-brand-neon/50 focus:bg-white/10 transition-all" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-xs font-black text-white/40 uppercase tracking-widest px-1">Source</label><LanguageSelector value={myLanguage} onChange={setMyLanguage} label="" /></div>
              <div className="space-y-2"><label className="text-xs font-black text-white/40 uppercase tracking-widest px-1">Target</label><LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label="" /></div>
            </div>
          </div>
          <button onClick={handleStartSession} className="group relative w-full py-6 bg-brand-neon text-brand-dark rounded-[30px] text-xl font-black shadow-2xl shadow-brand-neon/20 overflow-hidden transition-all hover:scale-[1.02] active:scale-95">
            <span className="relative z-10 flex items-center justify-center gap-3">START MEETING <Zap className="w-6 h-6" /></span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </div>
  );

  if (phase === 'connecting') return <div className="min-h-screen flex items-center justify-center bg-[#010b13] flex-col gap-6"><Activity className="w-16 h-16 text-brand-neon animate-pulse" /><div className="text-white/20 font-black tracking-[0.3em] text-xs uppercase">Initializing Neural Bridge</div></div>;

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#010b13] overflow-hidden fixed inset-0 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={ttsAudioRef} playsInline crossOrigin="anonymous" style={{ display: 'none' }} />
      {showInviteModal && renderInviteModal()}

      {/* Premium Header / Invite & Status Bar */}
      <header className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 bg-black/40 backdrop-blur-3xl z-50 shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 shadow-inner">
            <div className={`w-2 h-2 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_12px_#22C55E]' : 'bg-brand-neon shadow-[0_0_12px_rgba(163,230,53,1)]'} animate-pulse`} />
            <span className="text-xs font-black text-white tracking-tight">{participants.length} {t.onlineCount}</span>
          </div>
          <button 
            onClick={() => setShowInviteModal(true)} 
            className="flex items-center gap-2.5 px-5 py-2.5 bg-brand-neon/10 hover:bg-brand-neon/20 border border-brand-neon/20 text-brand-neon text-xs font-black rounded-2xl transition-all group"
          >
            <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
            <span>{t.inviteBtn}</span>
          </button>
        </div>

        {/* Real-time Status Center (Speaking Now) */}
        <div className="hidden md:flex flex-1 items-center justify-center px-10">
          {processingStatus.message ? (
            <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-brand-neon text-brand-dark font-black text-[11px] uppercase tracking-widest shadow-[0_0_20px_rgba(163,230,53,0.3)] animate-in fade-in zoom-in duration-300">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-dark opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-dark"></span>
              </div>
              {processingStatus.message}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/20 font-black text-[9px] uppercase tracking-[0.3em]">
              <Sparkles className="w-3 h-3" />
              Neural Bridge Active
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 bg-white/5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl border border-white/10">
            <span className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-widest">{getLanguageName(myLanguage)}</span>
            <div className="w-6 h-6 rounded-full bg-brand-neon/10 flex items-center justify-center"><ArrowRight className={`w-3 h-3 text-brand-neon ${isRtl ? 'scale-x-[-1]' : ''}`} /></div>
            <span className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-widest">{getLanguageName(partnerLanguage)}</span>
          </div>
        </div>
      </header>

      {/* Mobile-only status bar */}
      {processingStatus.message && (
        <div className="md:hidden absolute top-20 left-0 right-0 z-[100] flex justify-center p-2">
           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-neon text-brand-dark font-black text-[9px] uppercase tracking-widest shadow-xl animate-in slide-in-from-top-2">
              <Activity className="w-3 h-3 animate-bounce" />
              {processingStatus.message}
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-4 gap-3 sm:gap-6 min-h-0 relative">
        <div className="flex-1 min-h-0 rounded-[24px] sm:rounded-[40px] overflow-hidden border border-white/5 relative bg-black/40 shadow-2xl group transition-all duration-500">
          <VideoGrid />
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] font-black text-white/90 uppercase tracking-widest">Live Stream</span></div>
        </div>

        {/* Responsive Side Panel */}
        <aside className={`${sidePanelOpen ? 'flex' : 'hidden'} lg:flex fixed inset-0 top-[72px] sm:top-[88px] lg:relative lg:inset-auto lg:w-[400px] lg:h-full rounded-[24px] sm:rounded-[40px] overflow-hidden bg-gray-900/95 lg:bg-black/20 backdrop-blur-3xl lg:backdrop-blur-none border border-white/10 shadow-2xl flex flex-col shrink-0 z-[60] lg:z-10 animate-in slide-in-from-right duration-500`}>
          <div className="lg:hidden absolute top-4 right-4 z-[70]"><button onClick={() => useRoomStore.getState().toggleSidePanel()} className="p-3 bg-white/5 rounded-full border border-white/10 text-white"><X className="w-6 h-6" /></button></div>
          <SidePanel myId={participantId} myName={name || 'User'} myRole={role} myLanguage={myLanguage} partnerLanguage={partnerLanguage} onSendMessage={(m) => sendChatMessage(m)} />
        </aside>
      </main>

      {/* Controls Bar */}
      <footer className="shrink-0 p-2 sm:p-4 bg-transparent">
        <MeetingControls roomId={roomId} onEndCall={() => onLeave()} onToggleMic={handleToggleMic} onToggleCamera={handleToggleCamera} />
      </footer>
    </div>
  );
}

export default function RoomPage2(props: RoomPageProps) { return <RoomErrorBoundary><RoomPageContent {...props} /></RoomErrorBoundary>; }
