import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useWebSpeechRecognition } from '@/app-hooks/useWebSpeechRecognition';
import { useRealtimeTranslation } from '@/app-hooks/useRealtimeTranslation';
import { usePeerConnection } from '@/app-hooks/usePeerConnection';
import { useSocketRoom } from '@/app-hooks/useSocketRoom';
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

// BCP-47 locale map for Web Speech Synthesis \u2014 defined once at module level
const LANG_TO_LOCALE: Record<string, string> = {
  ar: 'ar-EG', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
  es: 'es-ES', it: 'it-IT', pt: 'pt-BR', ru: 'ru-RU',
  zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', tr: 'tr-TR',
  nl: 'nl-NL', pl: 'pl-PL', hi: 'hi-IN', fa: 'fa-IR',
};

export default function RoomPage2({ roomId, role, onLeave }: RoomPageProps) {
  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<RoomPhase>('setup');
  const [name, setName] = useState(role === 'host' ? 'المضيف' : '');
  const [myLanguage, setMyLanguage] = useState(role === 'host' ? 'ar' : detectBrowserLanguage());
  const [partnerLanguage, setPartnerLanguage] = useState(role === 'host' ? 'en' : 'ar');
  const [copied, setCopied] = useState(false);
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
  const { processRecognizedText } = useRealtimeTranslation();
  const {
    processingStatus, sidePanelOpen, participants,
    setMicOn, setCameraOn, addParticipant, updateParticipant,
    addChatMessage, setMyId: setStoreMyId,
    setProcessingStatus, createRoom, leaveRoom, setLocalStream,
    setRemoteStream, addTranscript, updateTranscript
  } = useRoomStore();

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
  const handleTranscriptReceived = useCallback(async (transcript: TranscriptEntry) => {
    // Show all transcripts, including local ones (server-side truth)
    addTranscript(transcript);
  }, [addTranscript]);

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

    // تحديث النص المترجم في الـ UI
    updateTranscript(data.originalId, {
      translatedText: data.translatedText,
      translatedLanguage: data.translatedLanguage,
    });

    // تحديث الـ status فقط — الميكروفون فاضل شغّال
    setProcessingStatus({ stage: 'synthesizing', message: `🔊 ${data.speakerName} يتحدث...` });

    const afterPlay = () => {
      // بعد انتهاء الصوت، رجّع الـ status للاستماع (الميكروفون لسه شغّال)
      if (shouldListenRef.current) {
        setProcessingStatus({ stage: 'listening', message: 'جاري الاستماع...' });
      } else {
        setProcessingStatus({ stage: 'idle', message: '' });
      }
    };

    const speakWithWebSpeech = (text: string, lang: string): Promise<void> =>
      new Promise((resolve) => {
        if (!('speechSynthesis' in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANG_TO_LOCALE[lang] || lang;
        utterance.rate = 1.05;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.speak(utterance);
        } else {
          window.speechSynthesis.speak(utterance);
        }
      });

    // شغّل الصوت (ElevenLabs أو Web Speech) بدون إيقاف الميكروفون
    if (data.audioBase64) {
      const audio = document.getElementById('tts-audio-player') as HTMLAudioElement;
      if (audio) {
        audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
        audio.onended = afterPlay;
        audio.onerror = () => speakWithWebSpeech(data.translatedText, data.translatedLanguage).then(afterPlay);
        audio.play().catch(() => speakWithWebSpeech(data.translatedText, data.translatedLanguage).then(afterPlay));
        return;
      }
    }

    speakWithWebSpeech(data.translatedText, data.translatedLanguage).then(afterPlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTranscript, setProcessingStatus]);

  const {
    sendChatMessage: socketSendChat,
    sendTranscript: socketSendTranscript,
    disconnect: socketDisconnect
  } = useSocketRoom({
    roomId: normalizedRoomId,
    participant: {
      id: participantIdRef.current,
      name: name || (role === 'host' ? 'المضيف' : 'الضيف'),
      role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera,
      isScreenSharing: false, isConnected: true,
    },
    enabled: phase !== 'setup',
    onChatMessage: handleChatMessage,
    onTranscriptReceived: handleTranscriptReceived,
    onTranslatedAudio: handleTranslatedAudio
  });

  // REST Fallback for Translation & TTS
  const translateRest = async (text: string, sourceLang: string, targetLang: string) => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang })
      });
      const data = await res.json();
      return data.translated;
    } catch (err) {
      console.error('REST Translation fallback error:', err);
      return text;
    }
  };

  const ttsRest = async (text: string, language: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language })
      });
      const data = await res.json();
      return data.audioBase64;
    } catch (err) {
      console.error('REST TTS fallback error:', err);
      return '';
    }
  };


  const hostParticipant = participants.find(p => p.role === 'host');

  const {
    isReady: isPeerReady, error: peerError, connectedPeers, connectToHost, setLocalStream: setPeerLocalStream,
    disconnect: peerDisconnect
  } = usePeerConnection({
    roomId: normalizedRoomId, isHost: role === 'host',
    myId: myPeerId,
    hostId: normalizedRoomId, // Predictable Host ID
    enabled: phase !== 'setup',
    onRemoteStream: handleRemoteStream,
    onChatMessage: () => { }, // Handled by Socket.IO
    onParticipantUpdate: () => { }, // Handled by Socket.IO
    onParticipantLeft: () => { }, // Handled by Socket.IO
    onConnectionChange: handleConnectionChange,
    onPeerConnected: () => { },
    onTranscriptReceived: () => { }, // Handled by Socket.IO
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

  const handleShareLink = useCallback(async () => {
    const link = getInviteLink();
    if (navigator.share) {
      try { await navigator.share({ title: 'انضم للاجتماع', url: link }); return; } catch { }
    }
    handleCopyLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInviteLink, handleCopyLink]);

  // ─── Speech & Media ──────────────────────────────────────────────
  const handleSpeechResult = useCallback(async (text: string, isFinal: boolean) => {
    processRecognizedText(text, isFinal, {
      speakerId: participantId, speakerName: name || (role === 'host' ? 'المضيف' : 'الضيف'),
      speakerRole: role, sourceLanguage: myLanguage, targetLanguage: partnerLanguage,
    }, async (entry) => {
      const enrichedEntry = { ...entry, originalLanguage: myLanguage };
      
      // 1. Try sending via Socket.IO
      socketSendTranscript(enrichedEntry);

      // 2. Fallback logic: If alone in room or socket disconnected, we can still show local translation
      if (isFinal && participants.length === 1) {
        // Just for visual feedback when alone
        const translated = await translateRest(entry.originalText, myLanguage, partnerLanguage);
        updateTranscript(entry.id, { translatedText: translated, translatedLanguage: partnerLanguage });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processRecognizedText, participantId, name, role, myLanguage, partnerLanguage, socketSendTranscript, participants.length]);

  const { isListening, isSupported, startListening, stopListening } = useWebSpeechRecognition({
    language: myLanguage, continuous: true, interimResults: true,
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
    if (phase === 'connecting' && isPeerReady && role === 'guest' && localStreamRef.current) {
      console.log('🚀 Guest initiating direct P2P connection to Host...');
      connectToHost(localStreamRef.current);
    }
  }, [phase, isPeerReady, role, connectToHost]);


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
    setLocalStream(stream);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableMic, enableCamera, setLocalStream]);

  const handleStartSession = useCallback(async () => {
    if (customRoomId && customRoomId !== roomId) {
      window.location.hash = `/room/${customRoomId}`;
      return;
    }

    setPhase('connecting');
    const myParticipant: Participant = {
      id: participantId, name: name || (role === 'host' ? 'المضيف' : 'الضيف'),
      role, language: myLanguage, isMicOn: enableMic, isCameraOn: enableCamera,
      isScreenSharing: false, isConnected: true,
    };
    addParticipant(myParticipant);
    setMicOn(enableMic);
    setCameraOn(enableCamera);

    getMediaStream().then(stream => {
      if (stream) {
        setPeerLocalStream(stream);
      }
    });

    const ttsPlayer = document.getElementById('tts-audio-player') as HTMLAudioElement;
    if (ttsPlayer) {
      ttsPlayer.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXv7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/////////////wAAAEhMYXZjNTkuMzcuMTAwAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs9SR+AAAAAAAAAAAAAAAAAAAA//OEAQAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEAwAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//OEBAAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
      ttsPlayer.play().catch(() => { });
    }

    if (enableMic && isSupported) {
      setProcessingStatus({ stage: 'listening', message: 'جاري الاستماع...' });
      shouldListenRef.current = true;

      if (role === 'host') {
        // Host: start mic immediately
        startListening();
        setMicOn(true);
      } else {
        // Guest: delay 1200ms to let WebRTC negotiation finish
        // without interfering with Web Speech API mic access
        setTimeout(() => {
          console.log('[Guest] Starting mic...');
          startListening();
          setMicOn(true);
        }, 1200);
      }
    }
    setCameraOn(enableCamera);
    setTimeout(() => setPhase('active'), role === 'host' ? 0 : 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, name, role, myLanguage, enableMic, enableCamera, addParticipant, getMediaStream, setPeerLocalStream, connectToHost, isSupported, startListening, setMicOn, setCameraOn, setProcessingStatus]);

  const handleToggleMic = useCallback(() => {
    if (isListening) {
      shouldListenRef.current = false;
      stopListening();
      setMicOn(false);
      setProcessingStatus({ stage: 'idle', message: '' });
      updateParticipant(participantId, { isMicOn: false });
    } else {
      shouldListenRef.current = true;
      startListening();
      setMicOn(true);
      setProcessingStatus({ stage: 'listening', message: 'جاري الاستماع...' });
      updateParticipant(participantId, { isMicOn: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, startListening, stopListening, setMicOn, setProcessingStatus, updateParticipant, participantId]);



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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowInviteModal(false)}>
      <div className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[32px] p-8 shadow-[0_0_80px_rgba(255,77,0,0.15)]" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FF4D00]/50 to-transparent" />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF4D00] to-[#ff7a40] flex items-center justify-center shadow-lg shadow-[#FF4D00]/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">دعوة للمشاركة</h3>
              <p className="text-sm text-gray-400 font-medium">{connectedPeers.length} متصلون حالياً</p>
            </div>
          </div>
          <button onClick={() => setShowInviteModal(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          <div className="relative group cursor-pointer" onClick={handleCopyLink}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#FF4D00] to-[#ff7a40] rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <p className="text-sm font-mono text-gray-300 break-all select-all pr-4">{getInviteLink()}</p>
              <Copy className="w-5 h-5 text-[#FF4D00] shrink-0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={handleCopyLink} className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-[#FF4D00] hover:bg-[#e64500] text-white shadow-lg shadow-[#FF4D00]/20'}`}>
              {copied ? <><Check className="w-5 h-5" /> تم النسخ!</> : <><Copy className="w-5 h-5" /> نسخ الرابط</>}
            </button>
            <button onClick={handleShareLink} className="py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-colors">
              <Share2 className="w-5 h-5" /> مشاركة
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 bg-[#050505] overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#FF4D00]/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-12 gap-6 animate-fade-up">
        {/* Left: Video Preview (Glassmorphism) */}
        <div className="lg:col-span-7 rounded-[40px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative aspect-[4/3] lg:aspect-video flex items-center justify-center group">
          <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ${enableCamera ? 'opacity-100' : 'opacity-0'}`} />

          {!enableCamera && (
            <div className="w-32 h-32 rounded-[32px] bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-white/5 flex items-center justify-center shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF4D00] to-[#ff7a40] opacity-20 blur-xl rounded-full" />
              <span className="relative z-10 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#FF4D00] to-[#ff7a40]">
                {(name || (role === 'host' ? 'م' : 'ض')).charAt(0)}
              </span>
            </div>
          )}

          {/* Elegant Floating Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-2 rounded-[24px] border border-white/10 shadow-2xl">
            <button onClick={() => setEnableMic(!enableMic)} className={`w-12 h-12 rounded-[16px] flex items-center justify-center transition-all ${enableMic ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}>
              {enableMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button onClick={async () => {
              const next = !enableCamera;
              setEnableCamera(next);
              if (next) {
                // فقط عند التشغيل — نطلب الستريم مرة واحدة
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
                if (stream && localVideoRef.current) {
                  localStreamRef.current = stream;
                  localVideoRef.current.srcObject = stream;
                }
              } else {
                localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
              }
            }} className={`w-12 h-12 rounded-[16px] flex items-center justify-center transition-all ${enableCamera ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}>
              {enableCamera ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Right: Settings Card */}
        <div className="lg:col-span-5 rounded-[40px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FF4D00]/30 to-transparent" />

          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF4D00]/20 to-transparent border border-[#FF4D00]/20 mb-4">
                <Sparkles className="w-8 h-8 text-[#FF4D00]" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight">{role === 'host' ? 'تجهيز الغرفة' : 'الانضمام للغرفة'}</h2>
              <p className="text-gray-400 mt-2 text-sm">استعد لبدء محادثة فورية ومترجمة</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 px-1">كود الغرفة</label>
                <input type="text" value={customRoomId} onChange={(e) => setCustomRoomId(e.target.value.toLowerCase())} dir="ltr" className="w-full px-5 py-4 rounded-[20px] bg-black/40 border border-white/10 text-white placeholder-gray-600 font-mono tracking-widest focus:outline-none focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00] transition-all lowercase" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 px-1">الاسم المستعار</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'host' ? 'المضيف' : 'اسمك'} dir="rtl" className="w-full px-5 py-4 rounded-[20px] bg-black/40 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00] transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LanguageSelector value={myLanguage} onChange={setMyLanguage} label="لغتك" />
                </div>
                <div className="space-y-2">
                  <LanguageSelector value={partnerLanguage} onChange={setPartnerLanguage} label="الطرف الآخر" />
                </div>
              </div>

              {peerError && <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center justify-center">⚠️ {peerError}</div>}
            </div>
          </div>

          <button onClick={handleStartSession} className="mt-8 w-full py-5 bg-gradient-to-r from-[#FF4D00] to-[#ff7a40] hover:from-[#e64500] hover:to-[#ff6120] text-white rounded-[24px] text-lg font-black flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(255,77,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Zap className="w-6 h-6" /> {role === 'host' ? 'إنشاء الغرفة وبدء الاتصال' : 'دخول الغرفة الآن'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderConnecting = () => (
    <div className="relative min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 bg-[#050505] overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#FF4D00]/10 rounded-full blur-[100px] animate-pulse" />

      <div className="relative z-10 text-center max-w-md animate-fade-up">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-[#FF4D00]/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#FF4D00] rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Radio className="w-8 h-8 text-[#FF4D00] animate-pulse" />
          </div>
        </div>

        <h2 className="text-3xl font-black text-white mb-4 tracking-tight">{role === 'host' ? 'في انتظار الضيف...' : 'جاري الاتصال الآمن...'}</h2>
        <p className="text-gray-400">يتم إنشاء نفق اتصال P2P مشفر وربط الصوت المترجم</p>

        {role === 'host' && (
          <div className="mt-10 p-6 bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Link2 className="w-5 h-5 text-[#FF4D00]" />
              <span className="font-bold text-white text-sm">شارك هذا الرابط للضيف:</span>
            </div>
            <div className="bg-black/50 rounded-[20px] p-4 mb-4 border border-white/5 cursor-pointer hover:border-[#FF4D00]/50 transition-colors" onClick={handleCopyLink}>
              <p className="text-xs font-mono text-[#FF4D00] break-all">{getInviteLink()}</p>
            </div>
            <button onClick={handleCopyLink} className={`w-full py-4 rounded-[20px] font-bold flex justify-center items-center gap-2 transition-all ${copied ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-[#FF4D00] hover:bg-[#e64500] text-white shadow-[0_0_20px_rgba(255,77,0,0.3)]'}`}>
              {copied ? '✓ تم النسخ بنجاح' : 'نسخ الرابط'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="h-[calc(100dvh-4rem)] flex flex-col bg-[#050505]">
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      <audio id="tts-audio-player" playsInline className="hidden" />
      {showInviteModal && renderInviteModal()}

      {/* Top Glass Header */}
      <div className="bg-white/5 backdrop-blur-2xl border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row items-center justify-between z-40 shadow-sm relative">
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl border border-white/5">
            <div className={`w-2 h-2 rounded-full ${participants.length > 1 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-[#FF4D00]'} animate-pulse`} />
            <span className="text-sm font-bold text-gray-200">{participants.length} متصل</span>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#FF4D00]/10 hover:bg-[#FF4D00]/20 border border-[#FF4D00]/20 text-[#FF4D00] text-sm font-bold rounded-2xl transition-all">
            <UserPlus className="w-4 h-4" /> دعوة
          </button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
          <MicStatusIndicator isRecording={isListening} volume={0} processingStatus={processingStatus} />
        </div>

        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/10 shadow-inner">
            <span className="text-sm font-bold text-white">{getLanguageName(myLanguage)}</span>
            <ArrowRight className="w-4 h-4 text-[#FF4D00]" />
            <span className="text-sm font-bold text-white">{getLanguageName(partnerLanguage)}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative p-2 sm:p-4 gap-2 sm:gap-4 bg-[#050505]">
        <div className={`min-h-0 rounded-[24px] sm:rounded-[32px] overflow-hidden border border-white/5 relative bg-[#0a0a0a] transition-all duration-300 ${sidePanelOpen ? 'flex-1 lg:flex-1' : 'flex-1'}`}>
          <VideoGrid />
        </div>

        {/* Sleek Integrated SidePanel */}
        {sidePanelOpen && (
          <div className="w-full lg:w-[400px] flex-1 lg:flex-none lg:h-full rounded-[24px] sm:rounded-[32px] overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col z-40 animate-fade-in shrink-0">
            <SidePanel
              myId={participantId}
              myName={name || (role === 'host' ? 'المضيف' : 'الضيف')}
              myRole={role}
              myLanguage={myLanguage}
              partnerLanguage={partnerLanguage}
              onSendMessage={(msg) => { addChatMessage(msg); socketSendChat(msg); }}
            />
          </div>
        )}
      </div>

      <MeetingControls roomId={roomId} onEndCall={handleEndCall} onToggleMic={handleToggleMic} />
    </div>
  );

  return phase === 'setup' ? renderSetup() : phase === 'connecting' ? renderConnecting() : renderActive();
}
