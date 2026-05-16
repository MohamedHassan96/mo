import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { MessageSquare, FileText, Users, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import TranscriptPanel from './TranscriptPanel';
import ParticipantsPanel from './ParticipantsPanel';
import type { SidePanelTab, ParticipantRole, ChatMessage } from '@/types';

interface SidePanelProps {
  myId: string;
  myName: string;
  myRole: ParticipantRole;
  myLanguage: string;
  partnerLanguage: string;
  onSendMessage?: (message: ChatMessage) => void;
}

const TABS: { id: SidePanelTab; labelKey: 'tabChat' | 'tabTranscript' | 'tabParticipants'; icon: typeof MessageSquare }[] = [
  { id: 'chat', labelKey: 'tabChat', icon: MessageSquare },
  { id: 'transcript', labelKey: 'tabTranscript', icon: FileText },
  { id: 'participants', labelKey: 'tabParticipants', icon: Users },
];

export default function SidePanel({ 
  myId, 
  myName, 
  myRole, 
  myLanguage, 
  partnerLanguage,
  onSendMessage 
}: SidePanelProps) {
  const {
    sidePanelTab,
    sidePanelOpen,
    chatMessages,
    transcripts,
    participants,
    setSidePanelTab,
    setSidePanelOpen,
  } = useRoomStore();

  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);

  if (!sidePanelOpen) return null;

  const getCount = (tab: SidePanelTab) => {
    switch (tab) {
      case 'chat': return chatMessages.length;
      case 'transcript': return transcripts.length;
      case 'participants': return participants.length;
    }
  };

  return (
    <div className="h-full w-full bg-white dark:bg-bg-dark-900 border-l border-gray-200 dark:border-white/10 flex flex-col">
      <div className="flex items-center border-b border-gray-200 dark:border-white/5 bg-white dark:bg-bg-dark-900">
        {TABS.map((tab) => {
          const count = getCount(tab.id);
          const isActive = sidePanelTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidePanelTab(tab.id)}
              className={`min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-4 text-xs sm:text-sm font-bold transition-all relative ${
                isActive
                  ? 'text-brand-muted dark:text-brand-neon'
                  : 'text-emerald-900/60 dark:text-white/40 hover:text-brand-dark dark:hover:text-white/70'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="truncate">{t[tab.labelKey]}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-brand-neon/20 text-brand-muted dark:text-brand-neon'
                    : 'bg-gray-100 dark:bg-white/5 text-emerald-900/40 dark:text-white/30'
                }`}>
                  {count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-neon shadow-[0_0_10px_rgba(163,230,53,0.5)]" />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSidePanelOpen(false)}
          className="p-4 text-emerald-800/40 dark:text-white/30 hover:text-brand-dark dark:hover:text-white/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {sidePanelTab === 'chat' && (
          <ChatPanel
            myId={myId}
            myName={myName}
            myRole={myRole}
            myLanguage={myLanguage}
            partnerLanguage={partnerLanguage}
            onSendMessage={onSendMessage}
          />
        )}
        {sidePanelTab === 'transcript' && (
          <TranscriptPanel transcripts={transcripts} myId={myId} />
        )}
        {sidePanelTab === 'participants' && (
          <ParticipantsPanel />
        )}
      </div>
    </div>
  );
}
