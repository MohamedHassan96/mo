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
  const [enableMic, setEnableMic] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [customRoomId, setCustomRoomId] = useState(roomId);

  const [fileTransfers, setFileTransfers] = useState<Record<string, { 
    name: string, progress: number, status: string, senderName: string, blob?: Blob 
  }>>({});

  const [systemHealth, setSystemHealth] = useState<{ ok: boolean, keys: Record<string, boolean> | null }>({ ok: false, keys: null });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setSystemHealth(await res.json());
      } catch (e) { console.error('Health check failed', e); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const myLanguageRef = useRef(myLanguage);
  useEffect(() => { myLanguageRef.current = myLanguage; }, [myLanguage]);

  const participantIdRef = useRef(participantId);
  useEffect(() => { participantIdRef.current = participantId; }, [participantId]);

  const isListeningRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);
  const shouldListenRef = useRef(false);

  const { processRecognizedText } = useRealtimeTranslation();
  const {
    processingStatus, sidePanelOpen, participants,
    isMicOn, isCameraOn: isCameraOnStore, audioPlaybackEnabled,
    localStream: storeLocalStream,
    setMicOn, setCameraOn, addParticipant, updateParticipant, removeParticipant,
    addChatMessage, setMyId: setStoreMyId,
    setProcessingStatus, createRoom, leaveRoom, setLocalStream: setStoreLocalStream,
    setRemoteStream, addTranscript, updateTranscript
  } = useRoomStore();

  const {
    startCamera, stopCamera, startAudio, replaceVideoTrack,
  } = useMediaDevices();

  useEffect(() => {
    localStreamRef.current = storeLocalStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = storeLocalStream;
  }, [storeLocalStream]);

  const handleRemoteStream = useCallback((stream: MediaStream, _peerId?: string) => {
    setRemoteStream(stream);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
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
    originalId: string; speakerName: string; originalText: string;
    translatedText: string; translatedLanguage: string; audioBase64: string;
  }) => {
    if (!data.translatedText?.trim()) return;
    updateTranscript(data.originalId, { translatedText: data.translatedText, translatedLanguage: data.translatedLanguage });
    if (!data.audioBase64) return;
    setProcessingStatus({ stage: 'synthesizing', message: t.synthesizingStatus(data.speakerName) });
    const afterPlay = () => {
      if (shouldListenRef.current) { startListeningRef.current?.(); setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); }
      else setProcessingStatus({ stage: 'idle', message: '' });
    };
    const audio = ttsAudioRef.current;
    if (audio) {
      if (isListeningRef.current) stopListeningRef.current?.();
      audio.pause(); audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
      audio.onended = afterPlay; audio.onerror = afterPlay;
      audio.play().catch(err => { console.warn('[TTS] Playback blocked', err); afterPlay(); });
    }
  }, [updateTranscript, setProcessingStatus, t]);

  const {
    sendChatMessage: socketSendChat, sendTranscript: socketSendTranscript,
    updateParticipant: socketUpdateParticipant, updateRoomConfig: socketUpdateRoomConfig,
    disconnect: socketDisconnect
  } = useSocketRoom({
    roomId: normalizedRoomId,
    participant: {
      id: participantIdRef.current, peerId: myPeerId, name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera,
      isScreenSharing: false, isConnected: true,
    },
    enabled: phase !== 'setup',
    onChatMessage: handleChatMessage, onTranscriptReceived: handleTranscriptReceived, onTranslatedAudio: handleTranslatedAudio
  });

  const {
    isReady: isPeerReady, connectedPeers, connectToHost, connectToPeer,
    replaceVideoTrack: peerReplaceVideoTrack, disconnect: peerDisconnect,
    sendData: peerSendData, sendFile: peerSendFile
  } = usePeerConnection({
    roomId: normalizedRoomId, isHost: role === 'host', myId: myPeerId, hostId: normalizedRoomId,
    enabled: phase !== 'setup',
    onRemoteStream: handleRemoteStream, onChatMessage: handleChatMessage,
    onParticipantUpdate: (p) => updateParticipant(p.id, p),
    onConnectionChange: handleConnectionChange, onParticipantLeft: (pid) => removeParticipant(pid),
    onTranscriptReceived: handleTranscriptReceived,
    onFileTransferStart: (f) => setFileTransfers(prev => ({ ...prev, [f.id]: { ...f, progress: 0, status: 'receiving' } })),
    onFileTransferProgress: (id, p) => setFileTransfers(prev => ({ ...prev, [id]: { ...prev[id], progress: p } })),
    onFileTransferComplete: (id, blob, name) => setFileTransfers(prev => ({ ...prev, [id]: { ...prev[id], progress: 100, status: 'completed', blob } })),
  });

  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    processRecognizedText(text, isFinal, {
      speakerId: participantId, speakerName: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder),
      speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage,
    }, async (entry) => {
      socketSendTranscript(entry);
      peerSendData({ type: 'transcript', payload: entry });
    });
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, socketSendTranscript, peerSendData, t]);

  const { isListening, isSupported, startListening, stopListening } = useSpeechToText({ language: myLanguage, onResult: handleSpeechResult });

  const config = useConfigStore((state) => state.config);
  useEffect(() => {
    if (phase === 'active' && (config.geminiApiKey || config.elevenLabsApiKey)) {
      socketUpdateRoomConfig({ geminiApiKey: config.geminiApiKey, elevenLabsApiKey: config.elevenLabsApiKey });
    }
  }, [phase, config.geminiApiKey, config.elevenLabsApiKey, socketUpdateRoomConfig]);

  useEffect(() => {
    isListeningRef.current = isListening; stopListeningRef.current = stopListening; startListeningRef.current = startListening;
  }, [isListening, stopListening, startListening]);

  useEffect(() => {
    setStoreMyId(participantId); if (role === 'host') createRoom(normalizedRoomId, participantId);
    return () => {
      stopListening(); socketDisconnect(); peerDisconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop()); leaveRoom();
    };
  }, []);

  useEffect(() => {
    if (phase === 'connecting' && isPeerReady && role === 'guest' && storeLocalStream) {
      connectToHost(new MediaStream(storeLocalStream.getVideoTracks()));
    }
  }, [phase, isPeerReady, role, connectToHost, storeLocalStream]);

  useEffect(() => {
    if (phase === 'setup' || !isPeerReady || !storeLocalStream) return;
    participants.map(p => p.peerId).filter((pid): pid is string => Boolean(pid && pid !== myPeerId))
      .forEach(pid => connectToPeer(pid, new MediaStream(storeLocalStream.getVideoTracks())));
  }, [phase, isPeerReady, storeLocalStream, participants, myPeerId, connectToPeer]);

  useEffect(() => {
    if (storeLocalStream) peerReplaceVideoTrack(storeLocalStream.getVideoTracks()[0] || null);
  }, [storeLocalStream, peerReplaceVideoTrack]);

  const handleStartSession = useCallback(async () => {
    if (customRoomId && customRoomId !== roomId) { window.location.hash = `/room/${customRoomId}`; return; }
    const { config } = useConfigStore.getState();
    if (config.geminiApiKey || config.elevenLabsApiKey) socketUpdateRoomConfig({ geminiApiKey: config.geminiApiKey, elevenLabsApiKey: config.elevenLabsApiKey });
    setPhase('connecting');
    addParticipant({ id: participantId, peerId: myPeerId, name: name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder), role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera, isScreenSharing: false, isConnected: true });
    setMicOn(enableMic); setCameraOn(enableCamera);
    await startAudio(); if (enableCamera) await startCamera();
    if (enableMic && isSupported) { setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); shouldListenRef.current = true; startListening(); }
    setTimeout(() => setPhase('active'), role === 'host' ? 0 : 2000);
  }, [participantId, name, role, myLanguage, enableMic, enableCamera, addParticipant, startAudio, startCamera, isSupported, startListening, setMicOn, setCameraOn, setProcessingStatus, t, customRoomId, roomId, myPeerId, socketUpdateRoomConfig]);

  const handleToggleMic = useCallback(() => {
    const next = !isMicOn;
    if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = next);
    if (next) { shouldListenRef.current = true; startListening(); setProcessingStatus({ stage: 'listening', message: t.listeningStatus }); }
    else { shouldListenRef.current = false; stopListening(); setProcessingStatus({ stage: 'idle', message: '' }); }
    setMicOn(next); setEnableMic(next);
    updateParticipant(participantId, { isMicOn: next }); socketUpdateParticipant({ isMicOn: next });
    peerSendData({ type: 'participant-update', payload: { id: participantId, isMicOn: next } as any });
  }, [isMicOn, startListening, stopListening, setMicOn, setProcessingStatus, updateParticipant, participantId, socketUpdateParticipant, peerSendData, t]);

  const handleToggleCamera = useCallback(async () => {
    const next = !isCameraOnStore; setEnableCamera(next); setCameraOn(next);
    updateParticipant(participantId, { isCameraOn: next }); socketUpdateParticipant({ isCameraOn: next });
    peerSendData({ type: 'participant-update', payload: { id: participantId, isCameraOn: next } as any });
    if (next) { const s = await startCamera(); if (s) peerReplaceVideoTrack(s.getVideoTracks()[0] || null); }
    else { stopCamera(); peerReplaceVideoTrack(null); }
  }, [isCameraOnStore, setCameraOn, updateParticipant, participantId, socketUpdateParticipant, peerSendData, startCamera, stopCamera, peerReplaceVideoTrack]);

  const handleEndCall = useCallback(() => {
    stopListening(); socketDisconnect(); peerDisconnect();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setMicOn(false); setCameraOn(false); onLeave();
  }, [stopListening, socketDisconnect, peerDisconnect, setMicOn, setCameraOn, onLeave]);

  const renderInviteModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-dark-950/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowInviteModal(false)} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-white dark:bg-bg-dark-900 border border-gray-200 dark:border-white/10 rounded-[32px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-neon/20 flex items-center justify-center"><Users className="w-6 h-6 text-brand-dark dark:text-brand-neon" /></div>
            <div>
              <h3 className="text-xl font-black text-brand-dark dark:text-white/95">{t.inviteModalTitle}</h3>
              <p className="text-sm text-emerald-900/60 dark:text-white/60 font-medium">{connectedPeers.length} {t.inviteModalActive}</p>
            </div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 text-emerald-800/40 dark:text-white/40" /></button>
        </div>
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4" onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }}>
            <p className="text-sm font-mono text-emerald-900/80 dark:text-white/80 break-all select-all text-left" dir="ltr">{`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`}</p>
            <Copy className="w-5 h-5 text-brand-neon shrink-0" />
          </div>
          <button onClick={async () => { await navigator.clipboard.writeText(`${window.location.href.split('#')[0]}#/room/${normalizedRoomId}`); setCopied(true); setTimeout(() => setCopied(false), 3000); }} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-brand-neon text-brand-dark shadow-lg shadow-brand-neon/20'}`}>
            {copied ? <><Check className="w-5 h-5" /> {t.linkCopied}</> : <><Copy className="w-5 h-5" /> {t.copyRoomLinkBtn}</>}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] flex items-center justify-center p-3 bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-3 sm:gap-6 animate-fade-up">
        <div className="lg:col-span-7 rounded-[32px] bg-white/80 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden relative aspect-video flex items-center justify-center">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />
          {!enableCamera && <div className="w-32 h-32 rounded-[40px] bg-white dark:bg-bg-dark-900 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-2xl relative"><span className="text-6xl font-black text-brand-neon">{(name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)).charAt(0)}</span></div>}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 backdrop-blur-xl p-2.5 rounded-[28px] border border-white/10 shadow-lg">
            <button onClick={() => setEnableMic(!enableMic)} className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all ${enableMic ? 'bg-white dark:bg-white/10 text-brand-dark dark:text-white' : 'bg-red-500 text-white'}`}>{enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}</button>
            <button onClick={() => setEnableCamera(!enableCamera)} className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all ${enableCamera ? 'bg-white dark:bg-white/10 text-brand-dark dark:text-white' : 'bg-red-500 text-white'}`}>{enableCamera ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}</button>
          </div>
        </div>
        <div className="lg:col-span-5 rounded-[32px] bg-white/90 dark:bg-white/5 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-xl p-5 sm:p-8 flex flex-col justify-center space-y-6">
          <div className="text-center"><h2 className="text-2xl font-black text-brand-dark dark:text-white/95">{role === 'host' ? t.roomSetupTitle : t.roomJoinTitle}</h2><p className="text-emerald-900/60 dark:text-white/60 mt-2 text-sm">{t.roomSetupDesc}</p></div>
          <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-bold text-emerald-900/70 dark:text-white/70 px-1">{t.roomCodeLabel}</label><input type="text" value={customRoomId} onChange={(e) => setCustomRoomId(e.target.value.toLowerCase())} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/10 text-brand-dark dark:text-white/90 outline-none" /></div>
            <div className="space-y-2"><label className="text-sm font-bold text-emerald-900/70 dark:text-white/70 px-1">{t.nameLabel}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder} className="w-full px-5 py-4 rounded-[20px] bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/10 text-brand-dark dark:text-white/90 outline-none" /></div>
            <div className="grid grid-cols-2 gap-4"><LanguageSelector value={myLanguage} onChange={setMyLanguage} label={t.myLanguageLabel} /><LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label={t.partnerLanguageLabel} /></div>
          </div>
          <button onClick={handleStartSession} className="w-full py-5 bg-brand-neon text-brand-dark rounded-[24px] text-lg font-black flex items-center justify-center gap-3 shadow-lg transition-all hover:scale-[1.02]"><Zap className="w-6 h-6" /> {role === 'host' ? t.startButtonHost : t.startButtonGuest}</button>
        </div>
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="h-[calc(100dvh-4rem)] sm:h-[100dvh] flex flex-col bg-gray-50 dark:bg-bg-dark-950 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      {showInviteModal && renderInviteModal()}
      <div className="bg-white/80 dark:bg-white/5 backdrop-blur-2xl border-b border-gray-200 dark:border-white/10 px-4 py-4 flex flex-row items-center justify-between z-40 relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-gray-200 dark:border-white/10">
            <div className={`w-2 h-2 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_10px_#22C55E]' : 'bg-brand-neon'} animate-pulse`} />
            <span className="text-sm font-bold text-emerald-900/80 dark:text-white/80">{participants.length} {t.onlineCount}</span>
          </div>
          
          {/* Pro Health Monitor */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${systemHealth.ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[10px] font-black uppercase text-gray-400 dark:text-white/40 tracking-tighter">System Ready</span>
            {systemHealth.keys && (
              <div className="flex gap-1 ml-1">
                {systemHealth.keys.groq && <span className="text-[9px] bg-brand-neon/10 text-brand-neon px-1 rounded">GROQ</span>}
                {systemHealth.keys.elevenLabs && <span className="text-[9px] bg-brand-neon/10 text-brand-neon px-1 rounded">11LABS</span>}
              </div>
            )}
          </div>

          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-neon/10 hover:bg-brand-neon/20 border border-brand-neon/20 text-brand-muted dark:text-brand-neon text-sm font-bold rounded-2xl transition-all"><UserPlus className="w-4 h-4" /> {t.inviteBtn}</button>
        </div>
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-white/5 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10">
          <span className="text-xs font-bold text-brand-dark dark:text-white/90">{getLanguageName(myLanguage)}</span>
          <ArrowRight className={`w-4 h-4 text-brand-neon ${isRtl ? 'scale-x-[-1]' : ''}`} />
          <span className="text-xs font-bold text-brand-dark dark:text-white/90">{getLanguageName(partnerLanguage)}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative p-4 gap-4 bg-gray-50 dark:bg-bg-dark-950">
        <div className="min-h-0 rounded-[32px] overflow-hidden border border-gray-200 dark:border-white/5 relative bg-white dark:bg-bg-dark-900 flex-1"><VideoGrid /></div>
        {sidePanelOpen && (
          <div className={`fixed ${isRtl ? 'left-4' : 'right-4'} top-24 bottom-24 lg:static lg:w-[400px] lg:h-full rounded-[32px] overflow-hidden bg-white/95 dark:bg-bg-dark-900/95 backdrop-blur-3xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col z-50 shrink-0`}>
            <SidePanel
              myId={participantId} myName={name || (role === 'host' ? t.hostNamePlaceholder : t.guestNamePlaceholder)}
              myRole={role} myLanguage={myLanguage} partnerLanguage={partnerLanguage}
              onSendMessage={(msg) => { addChatMessage(msg); socketSendChat(msg); peerSendData({ type: 'chat', payload: msg }); }}
              onSendFile={(f) => { setFileTransfers(prev => ({ ...prev, [Date.now()]: { name: f.name, progress: 0, status: 'sending', senderName: 'Me' } })); peerSendFile(f, name || 'User'); }}
              fileTransfers={fileTransfers}
            />
          </div>
        )}
      </div>
      <MeetingControls roomId={roomId} onEndCall={handleEndCall} onToggleMic={handleToggleMic} onToggleCamera={handleToggleCamera} />
    </div>
  );

  return (
    <>
      <audio ref={ttsAudioRef} id="tts-audio-player" playsInline style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', left: -9999 }} />
      {phase === 'setup' ? renderSetup() : phase === 'connecting' ? <div className="min-h-screen flex items-center justify-center bg-bg-dark-950"><Radio className="w-12 h-12 text-brand-neon animate-pulse" /></div> : renderActive()}
    </>
  );
}
