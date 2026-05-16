import { useState, useCallback } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  MessageSquare,
  MoreVertical,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Settings,
} from 'lucide-react';
import { playScreenShareSound } from '@/utils/sounds';

interface MeetingControlsProps {
  roomId: string;
  onEndCall: () => void;
  onToggleMic: () => void;
  onStartScreenShare?: (stream: MediaStream) => void;
  onStopScreenShare?: () => void;
}

export default function MeetingControls({
  roomId,
  onEndCall,
  onToggleMic,
  onStartScreenShare,
  onStopScreenShare
}: MeetingControlsProps) {
  const {
    isMicOn,
    isCameraOn,
    isScreenSharing,
    audioPlaybackEnabled,
    sidePanelOpen,
    localStream,
    setCameraOn,
    setScreenSharing,
    setAudioPlaybackEnabled,
    setLocalScreenStream,
    toggleSidePanel,
  } = useRoomStore();

  const { setShowSettings } = useConfigStore();
  
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}${window.location.pathname}#/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  const handleToggleCamera = useCallback(async () => {
    if (isCameraOn) {
      // Turn off camera
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
      }
      setCameraOn(false);
    } else {
      // Turn on camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        if (localStream) {
          // Add video track to existing stream
          const videoTrack = stream.getVideoTracks()[0];
          localStream.addTrack(videoTrack);
        }
        
        setCameraOn(true);
      } catch (err) {
        console.error('Failed to start camera:', err);
      }
    }
  }, [isCameraOn, localStream, setCameraOn]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      setLocalScreenStream(null);
      setScreenSharing(false);
      onStopScreenShare?.();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: true,
        });
        
        setLocalScreenStream(stream);
        setScreenSharing(true);
        onStartScreenShare?.(stream);
        playScreenShareSound();

        // Listen for when user stops sharing
        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStream(null);
          setScreenSharing(false);
          onStopScreenShare?.();
        };
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  }, [isScreenSharing, onStartScreenShare, onStopScreenShare, setLocalScreenStream, setScreenSharing]);

  return (
    <div className="bg-white/80 dark:bg-[#121212]/80 backdrop-blur-xl border-t border-gray-200 dark:border-[#1E1E1E] px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left side - Room info */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-[#1A1A1A] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] 
                       text-gray-600 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white rounded-full text-sm font-bold border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 transition-all"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-[#FF4D00]" />
            )}
            <span className="hidden sm:inline font-mono">{roomId}</span>
          </button>
        </div>

        {/* Center - Main controls */}
        <div className="flex items-center gap-3">
          {/* Mic */}
          <button
            onClick={onToggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 ${
              isMicOn
                ? 'bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-white'
                : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            }`}
            title={isMicOn ? 'كتم الميكروفون' : 'تشغيل الميكروفون'}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          {/* Camera */}
          <button
            onClick={handleToggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 ${
              isCameraOn
                ? 'bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-white'
                : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            }`}
            title={isCameraOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
          >
            {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 ${
              isScreenSharing
                ? 'bg-[#FF4D00] hover:bg-[#e64500] text-white border-none shadow-[0_0_20px_rgba(255,77,0,0.4)]'
                : 'bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-white'
            }`}
            title={isScreenSharing ? 'إيقاف المشاركة' : 'مشاركة الشاشة'}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-16 h-14 rounded-[20px] bg-red-600 hover:bg-red-700 text-white 
                       flex items-center justify-center transition-all mr-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]"
            title="إنهاء المكالمة"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        {/* Right side - Secondary controls */}
        <div className="flex items-center gap-3">
          {/* Audio playback */}
          <button
            onClick={() => setAudioPlaybackEnabled(!audioPlaybackEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 ${
              audioPlaybackEnabled
                ? 'bg-green-50 dark:bg-[#1E1E1E] hover:bg-green-100 dark:hover:bg-[#2A2A2A] text-green-600 dark:text-green-500'
                : 'bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-[#1A1A1A] text-gray-400 dark:text-[#A3A3A3]'
            }`}
            title={audioPlaybackEnabled ? 'كتم الترجمة الصوتية' : 'تشغيل الترجمة الصوتية'}
          >
            {audioPlaybackEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Chat toggle */}
          <button
            onClick={toggleSidePanel}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 ${
              sidePanelOpen
                ? 'bg-[#FF4D00] text-white shadow-[0_0_20px_rgba(255,77,0,0.3)] border-none'
                : 'bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white'
            }`}
            title="فتح/إغلاق الدردشة"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* More options */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-12 h-12 rounded-full bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 
                         flex items-center justify-center transition-all"
              title="المزيد"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMore && (
              <div className="absolute bottom-full right-0 mb-3 w-56 bg-white dark:bg-[#121212] rounded-[20px] shadow-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[#1E1E1E] overflow-hidden">
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowMore(false);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-gray-700 dark:text-[#D9D9D9] hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors"
                >
                  <Settings className="w-5 h-5 text-[#FF4D00]" />
                  الإعدادات
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
