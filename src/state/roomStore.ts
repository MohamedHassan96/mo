import { create } from 'zustand';
import type { Room, Participant, TranscriptEntry, ChatMessage, ProcessingStatus, SidePanelTab } from '@/types';

interface RoomState {
  room: Room | null;
  participants: Participant[];
  transcripts: TranscriptEntry[];
  chatMessages: ChatMessage[];
  myId: string;
  processingStatus: ProcessingStatus;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  audioPlaybackEnabled: boolean;
  sidePanelTab: SidePanelTab;
  sidePanelOpen: boolean;

  // Device Selection & Quality
  selectedVideoDevice: string;
  selectedAudioInputDevice: string;
  selectedAudioOutputDevice: string;
  cameraResolution: '360p' | '720p' | '1080p';
  isCameraMirrored: boolean;

  // Streams
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteScreenStreams: Record<string, MediaStream>;

  // Room actions
  createRoom: (roomId: string, hostId: string) => void;
  joinRoom: (guestId: string) => void;
  leaveRoom: () => void;

  // Participant actions
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
  setMyId: (id: string) => void;

  // Media controls
  setMicOn: (on: boolean) => void;
  setCameraOn: (on: boolean) => void;
  setScreenSharing: (on: boolean) => void;
  setAudioPlaybackEnabled: (on: boolean) => void;
  
  // Device selection & Quality actions
  setSelectedVideoDevice: (deviceId: string) => void;
  setSelectedAudioInputDevice: (deviceId: string) => void;
  setSelectedAudioOutputDevice: (deviceId: string) => void;
  setCameraResolution: (res: '360p' | '720p' | '1080p') => void;
  setCameraMirrored: (mirrored: boolean) => void;

  // Streams
  setLocalStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setRemoteScreenStream: (stream: MediaStream | null) => void;
  setRemoteStreamForPeer: (peerId: string, stream: MediaStream | null) => void;
  setRemoteScreenStreamForPeer: (peerId: string, stream: MediaStream | null) => void;

  // Transcripts
  addTranscript: (entry: TranscriptEntry) => void;
  updateTranscript: (id: string, updates: Partial<TranscriptEntry>) => void;
  clearTranscripts: () => void;

  // Chat
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  // Side panel
  setSidePanelTab: (tab: SidePanelTab) => void;
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;

  // Processing
  setProcessingStatus: (status: ProcessingStatus) => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  participants: [],
  transcripts: [],
  chatMessages: [],
  myId: '',
  processingStatus: { stage: 'idle', message: '' },
  isMicOn: false,
  isCameraOn: false,
  isScreenSharing: false,
  audioPlaybackEnabled: true,
  sidePanelTab: 'chat',
  sidePanelOpen: true,
  localStream: null,
  localScreenStream: null,
  remoteStream: null,
  remoteScreenStream: null,
  remoteStreams: {},
  remoteScreenStreams: {},

  // Device Selection & Quality defaults
  selectedVideoDevice: '',
  selectedAudioInputDevice: '',
  selectedAudioOutputDevice: '',
  cameraResolution: '720p',
  isCameraMirrored: true,

  createRoom: (roomId, hostId) =>
    set({
      room: {
        id: roomId,
        hostId,
        guestId: null,
        createdAt: Date.now(),
        isActive: true,
      },
    }),

  joinRoom: (guestId) =>
    set((state) => ({
      room: state.room ? { ...state.room, guestId } : null,
    })),

  leaveRoom: () =>
    set({
      room: null,
      participants: [],
      transcripts: [],
      chatMessages: [],
      isMicOn: false,
      isCameraOn: false,
      isScreenSharing: false,
      localStream: null,
      localScreenStream: null,
      remoteStream: null,
      remoteScreenStream: null,
      remoteStreams: {},
      remoteScreenStreams: {},
      processingStatus: { stage: 'idle', message: '' },
    }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants.filter((p) => p.id !== participant.id), participant],
    })),

  updateParticipant: (id, updates) =>
    set((state) => ({
      participants: state.participants.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  setMyId: (id) => set({ myId: id }),

  setMicOn: (on) => set({ isMicOn: on }),
  setCameraOn: (on) => set({ isCameraOn: on }),
  setScreenSharing: (on) => set({ isScreenSharing: on }),
  setAudioPlaybackEnabled: (on) => set({ audioPlaybackEnabled: on }),

  setSelectedVideoDevice: (deviceId) => set({ selectedVideoDevice: deviceId }),
  setSelectedAudioInputDevice: (deviceId) => set({ selectedAudioInputDevice: deviceId }),
  setSelectedAudioOutputDevice: (deviceId) => set({ selectedAudioOutputDevice: deviceId }),
  setCameraResolution: (res) => set({ cameraResolution: res }),
  setCameraMirrored: (mirrored) => set({ isCameraMirrored: mirrored }),

  setLocalStream: (stream) => set({ localStream: stream }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setRemoteScreenStream: (stream) => set({ remoteScreenStream: stream }),
  setRemoteStreamForPeer: (peerId, stream) =>
    set((state) => {
      const remoteStreams = { ...state.remoteStreams };
      if (stream) remoteStreams[peerId] = stream;
      else delete remoteStreams[peerId];
      return {
        remoteStreams,
        remoteStream: Object.values(remoteStreams)[0] ?? null,
      };
    }),
  setRemoteScreenStreamForPeer: (peerId, stream) =>
    set((state) => {
      const remoteScreenStreams = { ...state.remoteScreenStreams };
      if (stream) remoteScreenStreams[peerId] = stream;
      else delete remoteScreenStreams[peerId];
      return {
        remoteScreenStreams,
        remoteScreenStream: Object.values(remoteScreenStreams)[0] ?? null,
      };
    }),

  addTranscript: (entry) =>
    set((state) => ({
      transcripts: [...state.transcripts, entry],
    })),

  updateTranscript: (id, updates) =>
    set((state) => ({
      transcripts: state.transcripts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  clearTranscripts: () => set({ transcripts: [] }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  clearChat: () => set({ chatMessages: [] }),

  setSidePanelTab: (tab) => set({ sidePanelTab: tab }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  toggleSidePanel: () => set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),

  setProcessingStatus: (status) => set({ processingStatus: status }),
}));
