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
  onToggleCamera: () => void;
  onStartScreenShare?: (stream: MediaStream) => void;
  onStopScreenShare?: () => void;
}

export default function MeetingControls({
  roomId,
  onEndCall,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare
}: MeetingControlsProps) {
  const {
    isMicOn,
    isCameraOn,
    isScreenSharing,
    audioPlaybackEnabled,
    sidePanelOpen,
    setScreenSharing,
    setAudioPlaybackEnabled,
    setLocalScreenStream,
    toggleSidePanel,
  } = useRoomStore();

  const { setShowSettings } = useConfigStore();

  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(roomId.toUpperCase()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

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
    <div className="bg-white/80 dark:bg-bg-dark-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 px-3 sm:px-6 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleCopyLink}
            className="h-12 sm:h-auto w-12 sm:w-auto flex items-center justify-center sm:justify-start gap-2 sm:px-4 sm:py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 
                       text-brand-muted dark:text-white/60 hover:text-brand-dark dark:hover:text-white/95 rounded-full text-sm font-bold border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 transition-all"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-brand-neon" />
            )}
            <span className="hidden sm:inline font-mono">{roomId}</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleMic}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${isMicOn
                ? 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800 dark:text-white/90'
                : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20'
              }`}
          >
            {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <button
            onClick={onToggleCamera}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${isCameraOn
                ? 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800 dark:text-white/90'
                : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20'
              }`}
          >
            {isCameraOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <button
            onClick={handleToggleScreenShare}
            className={`hidden sm:flex w-14 h-14 rounded-full items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${isScreenSharing
                ? 'bg-brand-neon text-brand-dark border-none'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800 dark:text-white/90'
              }`}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
          </button>

          <button
            onClick={onEndCall}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-[18px] sm:rounded-[20px] bg-red-600 hover:bg-red-700 text-white 
                       flex items-center justify-center transition-all sm:mr-2 shadow-lg shadow-red-600/30"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setAudioPlaybackEnabled(!audioPlaybackEnabled)}
            className={`hidden sm:flex w-12 h-12 rounded-full items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${audioPlaybackEnabled
                ? 'bg-green-50 dark:bg-brand-neon/10 hover:bg-green-100 dark:hover:bg-brand-neon/20 text-green-600 dark:text-brand-neon'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800/40 dark:text-white/30'
              }`}
          >
            {audioPlaybackEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleSidePanel}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${sidePanelOpen
                ? 'bg-brand-neon text-brand-dark border-none shadow-lg shadow-brand-neon/20'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800/60 dark:text-white/60'
              }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-12 h-12 rounded-full bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-emerald-800/60 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 
                         flex items-center justify-center transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMore && (
              <div className="absolute bottom-full right-0 mb-3 w-60 bg-white dark:bg-bg-dark-900 rounded-[20px] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                <button
                  onClick={() => {
                    setAudioPlaybackEnabled(!audioPlaybackEnabled);
                    setShowMore(false);
                  }}
                  className="sm:hidden w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-emerald-900/70 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {audioPlaybackEnabled ? <Volume2 className="w-5 h-5 text-green-500" /> : <VolumeX className="w-5 h-5 text-brand-neon" />}
                  {audioPlaybackEnabled ? 'كتم صوت الترجمة' : 'تشغيل صوت الترجمة'}
                </button>
                <button
                  onClick={() => {
                    handleToggleScreenShare();
                    setShowMore(false);
                  }}
                  className="sm:hidden w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-emerald-900/70 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {isScreenSharing ? <MonitorOff className="w-5 h-5 text-brand-neon" /> : <MonitorUp className="w-5 h-5 text-brand-neon" />}
                  {isScreenSharing ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة'}
                </button>
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowMore(false);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm font-bold text-emerald-900/70 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-5 h-5 text-brand-neon" />
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
