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
    <div className="flex flex-col h-full bg-white dark:bg-bg-dark-900">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-dark dark:text-white/95">{t.participantsTitle}</h3>
        <span className="text-[10px] bg-brand-neon/20 text-brand-muted dark:text-brand-neon font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
          {participants.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-16 h-16 rounded-3xl bg-brand-neon/5 flex items-center justify-center mb-2">
              <User className="w-8 h-8 text-brand-muted/20 dark:text-brand-neon/20" />
            </div>
            <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.participantsEmpty}</p>
          </div>
        ) : (
          participants.map((participant) => {
            const isMe = participant.id === myId;
            const isHost = participant.role === 'host';
            return (
              <div
                key={participant.id}
                className={`flex items-center gap-3 p-4 rounded-[22px] border transition-all ${
                  isMe
                    ? 'bg-brand-neon/5 border-brand-neon/20 dark:bg-brand-neon/5'
                    : 'bg-gray-50/50 dark:bg-bg-dark-950/50 border-gray-100 dark:border-white/5'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  isHost
                    ? 'bg-gradient-to-br from-brand-neon to-brand-muted'
                    : 'bg-gradient-to-br from-emerald-600 to-brand-dark'
                }`}>
                  <span className="text-lg font-black text-white">
                    {(participant.name || '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-brand-dark dark:text-white/95 truncate text-sm">
                      {participant.name || t.participantUnknown}
                    </span>
                    {isMe && (
                      <span className="text-[8px] bg-brand-neon text-brand-dark font-black px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-tighter">
                        {t.participantYou}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isHost ? (
                      <div className="flex items-center gap-1">
                        <Crown className="w-3 h-3 text-brand-neon" />
                        <span className="text-[10px] font-bold text-brand-muted dark:text-brand-neon">{t.participantHost}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-800/40 dark:text-white/30" />
                        <span className="text-[10px] font-bold text-emerald-900/60 dark:text-white/40">{t.participantGuest}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-emerald-900/20 dark:text-white/10">·</span>
                    <span className="text-[10px] font-bold text-emerald-900/40 dark:text-white/30 truncate">
                      {getLanguageName(participant.language || 'en')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    participant.isCameraOn
                      ? 'bg-brand-neon/10 text-brand-muted dark:text-brand-neon'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {participant.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    participant.isMicOn
                      ? 'bg-brand-neon/10 text-brand-muted dark:text-brand-neon'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {participant.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
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
