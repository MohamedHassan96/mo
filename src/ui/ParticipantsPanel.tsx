import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { getLanguageName } from '@/config/languages';
import { Mic, MicOff, Video, VideoOff, MonitorUp, Crown, User } from 'lucide-react';

export default function ParticipantsPanel() {
  const { participants, myId } = useRoomStore();
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1E1E1E] flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white">{t.participantsTitle}</h3>
        <span className="text-xs bg-[#FF4D00]/10 text-[#FF4D00] font-bold px-2.5 py-1 rounded-full">
          {participants.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <User className="w-8 h-8 opacity-30" />
            <p className="text-sm text-center">{t.participantsEmpty}</p>
          </div>
        ) : (
          participants.map((participant) => {
            const isMe = participant.id === myId;
            const isHost = participant.role === 'host';
            return (
              <div
                key={participant.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-[#FF4D00]/5 border-[#FF4D00]/20 dark:bg-[#FF4D00]/10'
                    : 'bg-gray-50 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A]'
                }`}
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  isHost
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                    : 'bg-gradient-to-br from-indigo-500 to-violet-600'
                }`}>
                  <span className="text-lg font-extrabold text-white">
                    {(participant.name || '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white truncate text-sm">
                      {participant.name || t.participantUnknown}
                    </span>
                    {isMe && (
                      <span className="text-[10px] bg-[#FF4D00] text-white font-bold px-1.5 py-0.5 rounded-md shrink-0">
                        {t.participantYou}
                      </span>
                    )}
                  </div>
                  {/* Role + Language */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isHost ? (
                      <div className="flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{t.participantHost}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-400" />
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{t.participantGuest}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {getLanguageName(participant.language || 'en')}
                    </span>
                  </div>
                </div>

                {/* Status icons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {participant.isScreenSharing && (
                    <div className="w-7 h-7 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center" title={t.statusScreenShare}>
                      <MonitorUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </div>
                  )}
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    participant.isCameraOn
                      ? 'bg-green-100 dark:bg-green-500/20'
                      : 'bg-gray-100 dark:bg-[#2A2A2A]'
                  }`} title={participant.isCameraOn ? t.statusCamOn : t.statusCamOff}>
                    {participant.isCameraOn ? (
                      <Video className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <VideoOff className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    participant.isMicOn
                      ? 'bg-green-100 dark:bg-green-500/20'
                      : 'bg-gray-100 dark:bg-[#2A2A2A]'
                  }`} title={participant.isMicOn ? t.statusMicOn : t.statusMicOff}>
                    {participant.isMicOn ? (
                      <Mic className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
