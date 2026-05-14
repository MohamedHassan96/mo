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

  // Streams
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;

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

  // Streams
  setLocalStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setRemoteScreenStream: (stream: MediaStream | null) => void;

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

  setLocalStream: (stream) => set({ localStream: stream }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setRemoteScreenStream: (stream) => set({ remoteScreenStream: stream }),

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
