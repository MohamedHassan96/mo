import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { Send, Languages, Loader2, Paperclip, File, Download, CheckCircle2, X } from 'lucide-react';
import type { ChatMessage, ParticipantRole } from '@/types';

interface ChatPanelProps {
  myId: string;
  myName: string;
  myRole: ParticipantRole;
  myLanguage: string;
  partnerLanguage: string;
  onSendMessage?: (message: ChatMessage) => void;
  onSendFile?: (file: File) => void;
  fileTransfers?: Record<string, { name: string, progress: number, status: string, senderName: string, blob?: Blob }>;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ 
  myId, myName, myRole, myLanguage, partnerLanguage,
  onSendMessage, onSendFile, fileTransfers = {}
}: ChatPanelProps) {
  const { chatMessages } = useRoomStore();
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);
  
  const [message, setMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uniqueMessages = chatMessages.filter(
    (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [uniqueMessages.length, fileTransfers]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isTranslating) return;
    const messageText = message.trim();
    setMessage('');

    const chatMessage: ChatMessage = {
      id: uuid(), senderId: myId, senderName: myName, senderRole: myRole,
      text: messageText, timestamp: Date.now(),
    };

    if (autoTranslate && myLanguage !== partnerLanguage) {
      setIsTranslating(true);
      try {
        const response = await fetch('/api/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText, sourceLang: myLanguage, targetLang: partnerLanguage }),
        });
        const data = await response.json();
        if (data.ok) {
          chatMessage.translatedText = data.translated;
          chatMessage.originalLanguage = myLanguage;
          chatMessage.translatedLanguage = partnerLanguage;
        }
      } catch (err) { console.error('Translation error:', err); }
      setIsTranslating(false);
    }
    onSendMessage?.(chatMessage);
  }, [message, isTranslating, myId, myName, myRole, myLanguage, partnerLanguage, autoTranslate, onSendMessage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendFile) onSendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-dark-900">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-dark dark:text-white/95">{t.chatTitle}</h3>
        <button
          onClick={() => setAutoTranslate(!autoTranslate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
            autoTranslate ? 'bg-brand-neon/20 text-brand-muted dark:text-brand-neon' : 'bg-gray-100 dark:bg-white/5 text-emerald-900/40 dark:text-white/30'
          }`}
        >
          <Languages className="w-3.5 h-3.5" /> {t.chatAutoTranslate}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {uniqueMessages.length === 0 && Object.keys(fileTransfers).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.chatEmpty}</p>
          </div>
        ) : (
          <>
            {uniqueMessages.map((msg) => {
              const isMe = msg.senderId === myId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] mb-1.5 font-black text-emerald-700/60 dark:text-white/50">{msg.senderName}</span>
                  <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-brand-neon text-brand-dark rounded-tr-none' : 'bg-gray-100 dark:bg-white/5 dark:text-white rounded-tl-none'}`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    {msg.translatedText && msg.translatedText !== msg.text && (
                      <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] font-black uppercase opacity-50 mb-1">{t.chatTranslationLabel}</p>
                        <p className="text-sm font-bold">{msg.translatedText}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] mt-1 text-gray-400">{formatTime(msg.timestamp)}</span>
                </div>
              );
            })}

            {Object.entries(fileTransfers).map(([id, transfer]) => (
              <div key={id} className="flex flex-col items-center">
                <div className="w-full max-w-[280px] p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-neon/10 flex items-center justify-center">
                      <File className="w-5 h-5 text-brand-neon" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold dark:text-white truncate">{transfer.name}</p>
                      <p className="text-[9px] font-black uppercase text-brand-neon">{transfer.senderName}</p>
                    </div>
                    {transfer.blob && (
                      <button onClick={() => downloadFile(transfer.blob!, transfer.name)} className="p-2 bg-brand-neon text-brand-dark rounded-lg">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {transfer.status !== 'completed' && (
                    <div className="mt-3 space-y-1.5">
                      <div className="h-1.5 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-neon transition-all" style={{ width: `${transfer.progress}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase">
                        <span>{transfer.status}</span>
                        <span>{transfer.progress}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-bg-dark-900 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-400 rounded-2xl">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text" value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.chatInputPlaceholder}
            className="flex-1 px-5 py-3 rounded-2xl bg-gray-50 dark:bg-bg-dark-950 border border-gray-200 dark:border-white/10 text-sm dark:text-white outline-none"
          />
          <button onClick={handleSend} className="w-12 h-12 flex items-center justify-center bg-brand-neon text-brand-dark rounded-2xl">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
