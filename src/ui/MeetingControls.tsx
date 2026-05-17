import { useState, useCallback, useEffect } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { useMediaDevices } from '@/app-hooks/useMediaDevices';
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
  ChevronUp,
  Camera,
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
    selectedVideoDevice,
    setSelectedVideoDevice,
    setScreenSharing,
    setAudioPlaybackEnabled,
    setLocalScreenStream,
    toggleSidePanel,
  } = useRoomStore();

  const { setShowSettings } = useConfigStore();
  const { getDevices, startCamera } = useMediaDevices();

  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (showCameraMenu) {
      getDevices().then(devs => {
        setVideoDevices(devs.filter(d => d.kind === 'videoinput'));
      });
    }
  }, [showCameraMenu, getDevices]);

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

  const handleSwitchCamera = async (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    setShowCameraMenu(false);
    if (isCameraOn) {
      setTimeout(() => startCamera(), 100);
    } else {
      onToggleCamera();
    }
  };

  const handleFlipCamera = async () => {
    const devs = await getDevices();
    const videoDevs = devs.filter(d => d.kind === 'videoinput');
    if (videoDevs.length < 2) return;

    const currentIndex = videoDevs.findIndex(d => d.deviceId === selectedVideoDevice);
    const nextIndex = (currentIndex + 1) % videoDevs.length;
    const nextDevice = videoDevs[nextIndex];
    
    setSelectedVideoDevice(nextDevice.deviceId);
    if (isCameraOn) {
      setTimeout(() => startCamera(), 100);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-bg-dark-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 px-3 sm:px-6 py-3 sm:py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleCopyLink}
            className="h-12 sm:h-auto w-12 sm:w-auto flex items-center justify-center sm:justify-start gap-2 sm:px-4 sm:py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 
                       text-brand-muted dark:text-white/60 hover:text-brand-dark dark:hover:text-white/95 rounded-full text-sm font-bold border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 transition-all shadow-sm"
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
                ? 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-dark dark:text-white/90'
                : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20'
              }`}
          >
            {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <div className="relative flex items-center">
            <button
              onClick={onToggleCamera}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${isCameraOn
                  ? 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-dark dark:text-white/90'
                  : 'bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20'
                }`}
            >
              {isCameraOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            
            {/* Quick Toggle for Mobile Flip or Menu */}
            <button 
              onClick={() => {
                if (window.innerWidth < 640) handleFlipCamera();
                else setShowCameraMenu(!showCameraMenu);
              }}
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-bg-dark-800 border border-gray-200 dark:border-white/10 flex items-center justify-center hover:border-brand-neon transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3 h-3 text-brand-neon transition-transform ${showCameraMenu ? 'rotate-180' : ''}`} />
            </button>

            {showCameraMenu && (
              <div className="absolute bottom-full left-0 mb-4 w-64 bg-white dark:bg-bg-dark-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                  <p className="text-[10px] font-black text-brand-neon uppercase tracking-widest flex items-center gap-2">
                    <Camera className="w-3 h-3" />
                    تبديل الكاميرا
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {videoDevices.length > 0 ? (
                    videoDevices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleSwitchCamera(device.deviceId)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                          selectedVideoDevice === device.deviceId ? 'text-brand-neon bg-brand-neon/5' : 'text-gray-600 dark:text-white/70'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${selectedVideoDevice === device.deviceId ? 'bg-brand-neon animate-pulse' : 'bg-transparent'}`} />
                        <span className="truncate text-left">{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[10px] text-gray-400">جاري البحث عن كاميرات...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleToggleScreenShare}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${isScreenSharing
                ? 'bg-brand-neon text-brand-dark border-none'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-dark dark:text-white/90'
              }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <MonitorUp className="w-5 h-5 sm:w-6 sm:h-6" />}
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
            onClick={() => setShowMore(!showMore)}
            className="w-12 h-12 flex sm:hidden items-center justify-center bg-gray-50 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/10 text-brand-muted"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setAudioPlaybackEnabled(!audioPlaybackEnabled)}
            className={`hidden sm:flex w-12 h-12 rounded-full items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${audioPlaybackEnabled
                ? 'bg-brand-neon/10 dark:bg-brand-neon/10 hover:bg-brand-neon/20 dark:hover:bg-brand-neon/20 text-brand-muted dark:text-brand-neon'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-dark/40 dark:text-white/30'
              }`}
          >
            {audioPlaybackEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleSidePanel}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 ${sidePanelOpen
                ? 'bg-brand-neon text-brand-dark border-none shadow-lg shadow-brand-neon/20'
                : 'bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-muted/60 dark:text-white/60'
              }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-12 h-12 rounded-full bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-brand-muted/60 dark:text-white/60 border border-gray-200 dark:border-white/10 hover:border-brand-neon/50 
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
  </div>
);
}
