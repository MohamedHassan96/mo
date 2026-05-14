import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { User, Mic, MicOff, MonitorUp, Maximize2 } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isScreenShare?: boolean;
  isCameraOff?: boolean;
}

function VideoTile({ 
  stream, 
  name, 
  isLocal = false, 
  isMuted = false, 
  isScreenShare = false, 
  isCameraOff = false 
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isCameraOff;

  return (
    <div className={`relative rounded-[35px] overflow-hidden bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-[#1E1E1E] shadow-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${isScreenShare ? 'col-span-2 row-span-2' : ''} min-h-[200px]`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-contain ${isLocal && !isScreenShare ? 'transform scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#080808]">
          <div className="w-20 h-20 rounded-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#1E1E1E] shadow-lg dark:shadow-[0_0_30px_rgba(255,77,0,0.2)] flex items-center justify-center">
            {isScreenShare ? (
              <MonitorUp className="w-10 h-10 text-[#FF4D00]" />
            ) : (
              <span className="text-3xl font-bold text-[#FF4D00]">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Name badge */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3">
        <div className="px-4 py-2 rounded-full bg-white/80 dark:bg-[#080808]/80 backdrop-blur-md border border-gray-200 dark:border-[#1E1E1E] flex items-center gap-3">
          <span className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
            {name} {isLocal && '(أنت)'}
          </span>
          <div className="w-px h-4 bg-gray-300 dark:bg-[#1E1E1E]" />
          {isMuted ? (
            <MicOff className="w-4 h-4 text-red-500" />
          ) : (
            <Mic className="w-4 h-4 text-[#FF4D00]" />
          )}
        </div>
      </div>

      {/* Screen share indicator & Maximize button */}
      {isScreenShare && (
        <>
          <div className="absolute top-4 left-4 px-4 py-2 rounded-full bg-orange-50 dark:bg-[#FF4D00]/20 backdrop-blur-md border border-orange-200 dark:border-[#FF4D00]/50 flex items-center gap-2">
            <MonitorUp className="w-4 h-4 text-[#FF4D00]" />
            <span className="text-sm font-bold text-[#FF4D00]">مشاركة الشاشة</span>
          </div>
          <button 
            onClick={async () => {
              if (videoRef.current) {
                try {
                  if (videoRef.current.requestFullscreen) {
                    await videoRef.current.requestFullscreen();
                  } else if ((videoRef.current as any).webkitRequestFullscreen) {
                    (videoRef.current as any).webkitRequestFullscreen();
                  }
                } catch (e) {
                  console.error('Fullscreen failed', e);
                }
              }
            }}
            className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-white/80 dark:bg-[#080808]/80 hover:bg-gray-100 dark:hover:bg-[#121212] backdrop-blur-md rounded-full border border-gray-200 dark:border-[#1E1E1E] hover:border-[#FF4D00]/50 dark:hover:border-[#FF4D00]/50 text-gray-600 dark:text-[#A3A3A3] hover:text-[#FF4D00] dark:hover:text-[#FF4D00] transition-all hover:scale-105 shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            title="توسيع الشاشة"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}

export default function VideoGrid() {
  const {
    localStream,
    localScreenStream,
    remoteStream,
    remoteScreenStream,
    participants,
    myId,
    isMicOn,
    isCameraOn,
  } = useRoomStore();

  const myParticipant = participants.find(p => p.id === myId);
  const remoteParticipant = participants.find(p => p.id !== myId);

  const hasRemote = remoteStream || remoteParticipant;
  const hasScreenShare = localScreenStream || remoteScreenStream;

  // Determine grid layout
  const getGridClass = () => {
    if (hasScreenShare) {
      return 'grid-cols-3 grid-rows-2';
    }
    if (hasRemote) {
      return 'grid-cols-2';
    }
    return 'grid-cols-1';
  };

  return (
    <div className={`flex-1 grid gap-4 ${getGridClass()} auto-rows-fr`}>
      {/* Screen shares take priority */}
      {localScreenStream && (
        <VideoTile
          stream={localScreenStream}
          name={myParticipant?.name || 'أنت'}
          isLocal
          isScreenShare
          isMuted={!isMicOn}
        />
      )}
      
      {remoteScreenStream && (
        <VideoTile
          stream={remoteScreenStream}
          name={remoteParticipant?.name || 'الضيف'}
          isScreenShare
          isMuted={false}
        />
      )}

      {/* Local video */}
      <VideoTile
        stream={localStream}
        name={myParticipant?.name || 'أنت'}
        isLocal
        isMuted={!isMicOn}
        isCameraOff={!isCameraOn}
      />

      {/* Remote video or waiting placeholder */}
      {hasRemote ? (
        <VideoTile
          stream={remoteStream}
          name={remoteParticipant?.name || 'الضيف'}
          isMuted={remoteParticipant?.isMicOn === false}
          isCameraOff={remoteParticipant?.isCameraOn === false}
        />
      ) : (
        <div className="rounded-2xl bg-gray-800/50 border-2 border-dashed border-gray-700 flex flex-col items-center justify-center p-8 min-h-[200px]">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 text-center">
            في انتظار انضمام الآخرين...
          </p>
          <p className="text-gray-500 text-sm mt-2 text-center">
            شارك رابط الدعوة للبدء
          </p>
        </div>
      )}
    </div>
  );
}
