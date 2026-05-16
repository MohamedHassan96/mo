import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { useMediaDevices } from '@/app-hooks/useMediaDevices';
import { getTranslations } from '@/config/i18n';
import { User, Mic, MicOff, Monitor, Maximize2, Settings, Sliders, Info } from 'lucide-react';

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
  isCameraOff = false,
  t
}: VideoTileProps & { t: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isCameraMirrored } = useRoomStore();
  const { capabilities, setZoom } = useMediaDevices();
  const [showStats, setShowStats] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;

    // Detect resolution
    if (stream && stream.getVideoTracks().length > 0) {
      const settings = stream.getVideoTracks()[0].getSettings();
      if (settings.width && settings.height) {
        setResolution(`${settings.width}x${settings.height} @ ${Math.round(settings.frameRate || 0)}fps`);
      }
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isCameraOff;
  const zoomCaps = (isLocal && capabilities) ? (capabilities as any).zoom : null;

  return (
    <div className={`relative rounded-[28px] overflow-hidden bg-gray-50 dark:bg-bg-dark-900 border border-gray-200 dark:border-white/5 shadow-xl transition-all ${isScreenShare ? 'lg:col-span-2 lg:row-span-2' : ''} min-h-[220px] sm:min-h-[240px]`}>
      {hasVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-contain bg-black ${isLocal && !isScreenShare && isCameraMirrored ? 'transform scale-x-[-1]' : ''}`}
          />

          {/* Pro Overlays */}
          {isLocal && (
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              <button 
                onClick={() => setShowStats(!showStats)}
                className="w-8 h-8 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>

              {showStats && (
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 animate-in fade-in slide-in-from-left-2">
                  <p className="text-[9px] font-black text-brand-neon uppercase tracking-tighter mb-1">Live Feed Stats</p>
                  <p className="text-[10px] text-white font-mono">{resolution}</p>
                </div>
              )}
            </div>
          )}

          {/* Zoom Slider for Local Camera */}
          {isLocal && !isScreenShare && zoomCaps && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 z-10 group opacity-40 hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3 text-white/50" />
              <input
                type="range"
                min={zoomCaps.min}
                max={zoomCaps.max}
                step={zoomCaps.step || 0.1}
                defaultValue={zoomCaps.min}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="h-24 w-1 appearance-none bg-white/20 rounded-full outline-none accent-brand-neon cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
              />
              <Sliders className="w-3 h-3 text-white/50" />
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-bg-dark-950">
          <div className="w-20 h-20 rounded-[32px] bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center shadow-2xl">
            {isScreenShare ? (
                <MonitorUp className="w-10 h-10 text-brand-neon" />
            ) : (
              <span className="text-3xl font-black text-brand-neon uppercase">
                {name.charAt(0)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex items-center gap-2 max-w-[calc(100%-2rem)]">
        <div className="px-4 py-2 rounded-2xl bg-white/80 dark:bg-bg-dark-950/60 backdrop-blur-md border border-gray-200 dark:border-white/10 flex items-center gap-3">
          <span className="truncate text-xs font-black text-brand-dark dark:text-white/95 uppercase tracking-tighter">
            {name} {isLocal && t.videoGridYou}
          </span>
          <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-brand-neon" />
          )}
        </div>
      </div>

      {isScreenShare && (
        <>
          <div className="absolute top-4 left-4 px-4 py-2 rounded-2xl bg-brand-neon text-brand-dark border-none flex items-center gap-2 shadow-lg shadow-brand-neon/30">
            <MonitorUp className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">{t.videoGridScreenShare}</span>
          </div>
          <button
            onClick={async () => {
              if (videoRef.current) {
                try {
                  await videoRef.current.requestFullscreen?.();
                } catch (e) {
                  console.error('Fullscreen failed', e);
                }
              }
            }}
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center bg-white/80 dark:bg-bg-dark-950/60 hover:bg-brand-neon dark:hover:bg-brand-neon backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 text-brand-muted dark:text-white/60 hover:text-brand-dark dark:hover:text-brand-dark transition-all"
            title={t.videoGridExpand}
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
    remoteStreams,
    remoteScreenStreams,
    participants,
    myId,
    isMicOn,
    isCameraOn,
  } = useRoomStore();

  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);

  const myParticipant = participants.find((p) => p.id === myId);
  const remoteParticipants = participants.filter((p) => p.id !== myId);
  const remoteVideoTiles = remoteParticipants.map((participant) => ({
    participant,
    stream: participant.peerId ? remoteStreams[participant.peerId] ?? null : null,
  }));
  const remoteScreenTiles = remoteParticipants
    .map((participant) => ({
      participant,
      stream: participant.peerId ? remoteScreenStreams[participant.peerId] ?? null : null,
    }))
    .filter((tile): tile is { participant: typeof remoteParticipants[number]; stream: MediaStream } => Boolean(tile.stream));

  const tileCount = 1 + remoteVideoTiles.length + remoteScreenTiles.length + (localScreenStream ? 1 : 0);
  const gridClass = tileCount <= 1
    ? 'grid-cols-1'
    : tileCount === 2
      ? 'grid-cols-1 lg:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className={`h-full min-h-0 grid gap-4 ${gridClass} auto-rows-fr overflow-y-auto p-1`}>
      {localScreenStream && (
        <VideoTile
          stream={localScreenStream}
          name={myParticipant?.name || t.videoGridYou}
          isLocal
          isScreenShare
          isMuted={!isMicOn}
          t={t}
        />
      )}

      {remoteScreenTiles.map(({ participant, stream }) => (
        <VideoTile
          key={`screen-${participant.id}`}
          stream={stream}
          name={participant.name}
          isScreenShare
          isMuted={participant.isMicOn === false}
          t={t}
        />
      ))}

      <VideoTile
        stream={localStream}
        name={myParticipant?.name || t.videoGridYou}
        isLocal
        isMuted={!isMicOn}
        isCameraOff={!isCameraOn}
        t={t}
      />

      {remoteVideoTiles.length > 0 ? (
        remoteVideoTiles.map(({ participant, stream }) => (
          <VideoTile
            key={participant.id}
            stream={stream}
            name={participant.name}
            isMuted={participant.isMicOn === false}
            isCameraOff={participant.isCameraOn === false}
            t={t}
          />
        ))
      ) : (
        <div className="rounded-[32px] bg-gray-50 dark:bg-bg-dark-900/50 border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center p-8 min-h-[220px]">
          <div className="w-16 h-16 rounded-full bg-brand-neon/5 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-brand-muted/20 dark:text-brand-neon/20" />
          </div>
          <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.videoGridWaiting}</p>
          <p className="text-xs mt-2 text-center text-emerald-900/20 dark:text-white/10">{t.videoGridSharePrompt}</p>
        </div>
      )}
    </div>
  );
}
