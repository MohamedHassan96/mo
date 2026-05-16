import { useCallback, useRef, useState } from 'react';
import { useRoomStore } from '@/state/roomStore';

interface UseMediaDevicesReturn {
  // Camera
  startCamera: () => Promise<MediaStream | null>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
  
  // Screen share
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  toggleScreenShare: () => Promise<void>;
  
  // State
  cameraError: string | null;
  screenShareError: string | null;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const {
    isCameraOn,
    isScreenSharing,
    localStream,
    setCameraOn,
    setScreenSharing,
    setLocalStream,
    setLocalScreenStream,
  } = useRoomStore();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ─── Camera ───────────────────────────────────────────────────

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setCameraError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false, 
      });

      cameraStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      
      if (localStream) {
        // Clear existing video tracks first
        localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
          track.stop();
          localStream.removeTrack(track);
        });
        localStream.addTrack(videoTrack);
        // Trigger a store update by spreading the stream (some React versions need this for re-render)
        setLocalStream(localStream);
      } else {
        setLocalStream(stream);
      }
      
      setCameraOn(true);
      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setCameraError('Camera permission denied. Please allow camera access.');
      } else if (message.includes('NotFoundError')) {
        setCameraError('No camera found. Please connect a camera.');
      } else {
        setCameraError(message);
      }
      return null;
    }
  }, [localStream, setCameraOn, setLocalStream]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        localStream.removeTrack(track);
        track.stop();
      });
    }
    
    setCameraOn(false);
    setCameraError(null);
  }, [localStream, setCameraOn]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isCameraOn, startCamera, stopCamera]);

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
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    cameraError,
    screenShareError,
  };
}
