import { useCallback, useRef, useState } from 'react';
import { useRoomStore } from '@/state/roomStore';

interface UseMediaDevicesReturn {
  // Camera
  startCamera: () => Promise<MediaStream | null>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
  replaceVideoTrack: (track: MediaStreamTrack | null) => void;
  
  // Audio
  startAudio: () => Promise<MediaStream | null>;
  stopAudio: () => void;
  
  // Screen share
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  toggleScreenShare: () => Promise<void>;
  
  // Devices
  getDevices: () => Promise<MediaDeviceInfo[]>;

  // State
  cameraError: string | null;
  screenShareError: string | null;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const {
    isCameraOn,
    isMicOn,
    isScreenSharing,
    localStream,
    selectedVideoDevice,
    selectedAudioInputDevice,
    cameraResolution,
    setCameraOn,
    setMicOn,
    setScreenSharing,
    setLocalStream,
    setLocalScreenStream,
  } = useRoomStore();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ─── Devices ──────────────────────────────────────────────────

  const getDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      // First, we need to request permission to get labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      return await navigator.mediaDevices.enumerateDevices();
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }, []);

  // ─── Camera ───────────────────────────────────────────────────

  const getResolutionConstraints = (res: '360p' | '720p' | '1080p') => {
    switch (res) {
      case '360p': return { width: { ideal: 640 }, height: { ideal: 360 } };
      case '1080p': return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case '720p':
      default: return { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
  };

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setCameraError(null);
      
      const constraints: MediaStreamConstraints = {
        video: {
          ...getResolutionConstraints(cameraResolution),
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          facingMode: selectedVideoDevice ? undefined : 'user',
        },
        audio: false, 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      cameraStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      
      let newStream: MediaStream;
      if (localStream) {
        // Clear existing video tracks
        localStream.getVideoTracks().forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });

        newStream = new MediaStream([
          ...localStream.getAudioTracks(),
          videoTrack
        ]);
      } else {
        newStream = stream;
      }
      
      setLocalStream(newStream);
      setCameraOn(true);
      return newStream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      setCameraError(message);
      return null;
    }
  }, [cameraResolution, localStream, selectedVideoDevice, setCameraOn, setLocalStream]);

  // ─── Audio ────────────────────────────────────────────────────

  const startAudio = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedAudioInputDevice ? { exact: selectedAudioInputDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];
      
      // Initial mic state
      audioTrack.enabled = isMicOn;

      let newStream: MediaStream;
      if (localStream) {
        // Clear existing audio tracks
        localStream.getAudioTracks().forEach(track => {
          track.stop();
          localStream.removeTrack(track);
        });

        newStream = new MediaStream([
          ...localStream.getVideoTracks(),
          audioTrack
        ]);
      } else {
        newStream = stream;
      }

      setLocalStream(newStream);
      return newStream;
    } catch (err) {
      console.error('Failed to start audio:', err);
      return null;
    }
  }, [selectedAudioInputDevice, isMicOn, localStream, setLocalStream]);

  const stopAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.stop();
        localStream.removeTrack(track);
      });
      setLocalStream(new MediaStream([...localStream.getVideoTracks()]));
    }
    setMicOn(false);
  }, [localStream, setLocalStream, setMicOn]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.stop();
        localStream.removeTrack(track);
      });
      
      // Create a NEW MediaStream with only audio to trigger UI update
      const audioOnlyStream = new MediaStream([...localStream.getAudioTracks()]);
      setLocalStream(audioOnlyStream);
    }
    
    setCameraOn(false);
    setCameraError(null);
  }, [localStream, setCameraOn, setLocalStream]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isCameraOn, startCamera, stopCamera]);

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(vt => {
      vt.stop();
      localStream.removeTrack(vt);
    });

    if (track) {
      localStream.addTrack(track);
    }
    
    // Create new stream to force re-render
    setLocalStream(new MediaStream(localStream.getTracks()));
  }, [localStream, setLocalStream]);

  // ─── Screen Share ─────────────────────────────────────────────

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setScreenShareError(null);
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      setScreenSharing(true);

      // Listen for when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to share screen';
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setScreenShareError('Screen sharing was cancelled.');
      } else {
        setScreenShareError(message);
      }
      return null;
    }
  }, [setLocalScreenStream, setScreenSharing]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    setLocalScreenStream(null);
    setScreenSharing(false);
    setScreenShareError(null);
  }, [setLocalScreenStream, setScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    startCamera,
    stopCamera,
    toggleCamera,
    replaceVideoTrack,
    startAudio,
    stopAudio,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    getDevices,
    cameraError,
    screenShareError,
  };
}
