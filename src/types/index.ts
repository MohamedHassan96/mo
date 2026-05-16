// ─── Language Configuration ─────────────────────────────────────

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  ttsCode: string;
}

// ─── Room & Participants ────────────────────────────────────────

export type ParticipantRole = 'host' | 'guest';

export interface Participant {
  id: string;
  peerId?: string;
  name: string;
  role: ParticipantRole;
  language: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  guestId: string | null;
  createdAt: number;
  isActive: boolean;
}

// ─── Transcript ─────────────────────────────────────────────────

export interface TranscriptEntry {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole: ParticipantRole;
  originalText: string;
  originalLanguage: string;
  translatedText: string;
  translatedLanguage: string;
  timestamp: number;
  audioUrl?: string;
}

// ─── Chat Messages ──────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: ParticipantRole;
  text: string;
  timestamp: number;
  // حقول الترجمة
  translatedText?: string;
  originalLanguage?: string;
  translatedLanguage?: string;
  // للتوافق مع الكود القديم
  isTranslated?: boolean;
  originalText?: string;
}

// ─── Audio Chunk ────────────────────────────────────────────────

export interface AudioChunkMeta {
  roomId: string;
  speakerId: string;
  sourceLanguage: string;
  targetLanguage: string;
  chunkIndex: number;
}

// ─── Processing Status ─────────────────────────────────────────

export type ProcessingStage =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'translating'
  | 'synthesizing'
  | 'playing'
  | 'error';

export interface ProcessingStatus {
  stage: ProcessingStage;
  message: string;
}

// ─── API Configuration ─────────────────────────────────────────

export type TTSProvider = 'elevenlabs' | 'coqui' | 'browser';

export interface AppConfig {
  groqApiKey: string;
  geminiApiKey: string;
  ttsProvider: TTSProvider;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  xttsUrl: string;
  xttsApiToken: string;
}

// ─── Theme ──────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';

// ─── WebRTC ─────────────────────────────────────────────────────

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
}

export type SignalingMessage = 
  | { type: 'offer'; sdp: string; from: string }
  | { type: 'answer'; sdp: string; from: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'participant-update'; participant: Participant }
  | { type: 'screen-share-start'; from: string }
  | { type: 'screen-share-stop'; from: string };

// ─── Side Panel ─────────────────────────────────────────────────

export type SidePanelTab = 'chat' | 'transcript' | 'participants';
