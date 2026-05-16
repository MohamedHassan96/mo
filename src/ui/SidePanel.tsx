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
    <div className="h-full w-full bg-gray-50 dark:bg-[#112240] border-l border-gray-200 dark:border-[#1E1E1E] flex flex-col">
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#112240]">
        {TABS.map((tab) => {
          const count = getCount(tab.id);
          const isActive = sidePanelTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidePanelTab(tab.id)}
              className={`min-w-0 flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-3 text-xs sm:text-sm font-bold transition-colors ${
                isActive
                  ? 'text-[#006494] border-b-2 border-[#006494]'
                  : 'text-gray-500 hover:text-gray-700 dark:text-[#A3A3A3] dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="truncate">{t[tab.labelKey]}</span>
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-[#006494]/10 text-[#006494]'
                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-[#A3A3A3]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSidePanelOpen(false)}
          className="p-3 text-gray-400 hover:text-gray-600 dark:text-[#A3A3A3] dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
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
