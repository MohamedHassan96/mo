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
  const isSendingRef = useRef(false);
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

  const translateViaServer = useCallback(async (text: string, sourceLang: string, targetLang: string) => {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Translation failed: ${response.status}`);
    }
    return String(data.translated || '').trim();
  }, []);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isTranslating || isSendingRef.current) return;

    isSendingRef.current = true;
    const messageText = message.trim();
    setMessage('');

    try {
      const chatMessage: ChatMessage = {
        id: uuid(),
        senderId: myId,
        senderName: myName,
        senderRole: myRole,
        text: messageText,
        timestamp: Date.now(),
      };

      if (myLanguage !== partnerLanguage) {
        setIsTranslating(true);
        try {
          const translatedText = await translateViaServer(
            messageText,
            myLanguage,
            partnerLanguage
          );

          chatMessage.translatedText = translatedText;
          chatMessage.originalLanguage = myLanguage;
          chatMessage.translatedLanguage = partnerLanguage;
        } catch (err) {
          console.warn('[Chat] Translation failed, sending original fallback:', err);
          chatMessage.translatedText = messageText;
          chatMessage.originalLanguage = myLanguage;
          chatMessage.translatedLanguage = partnerLanguage;
        }
        setIsTranslating(false);
      }

      onSendMessage?.(chatMessage);
    } finally {
      isSendingRef.current = false;
    }
  }, [message, isTranslating, myId, myName, myRole, myLanguage, partnerLanguage, translateViaServer, onSendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black bg-brand-neon/20 text-brand-muted dark:text-brand-neon"
        >
          <Languages className="w-3.5 h-3.5" />
          {t.chatAutoTranslate}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {uniqueMessages.length === 0 && Object.keys(fileTransfers).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.chatEmpty}</p>
            <p className="text-xs text-center mt-1 text-emerald-900/20 dark:text-white/10">{t.chatStart}</p>
          </div>
        ) : (
          <>
            {uniqueMessages.map((msg) => {
              const isMe = msg.senderId === myId;
              const hasTranslation = !!(msg.translatedText && msg.translatedText !== msg.text);

              const mainText = hasTranslation ? msg.translatedText : msg.text;
              const subText = hasTranslation ? msg.text : null;
              const originalLabel = uiLanguage === 'ar' ? 'النص الأصلي:' : 'Original Text:';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className={`text-[11px] mb-1.5 font-black ${msg.senderRole === 'host' ? 'text-brand-muted dark:text-brand-neon' : 'text-emerald-700/60 dark:text-white/50'}`}>
                    {msg.senderName}
                  </span>

                  <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm px-4 py-3 ${isMe ? 'bg-brand-neon rounded-tr-none text-brand-dark' : 'bg-gray-100 dark:bg-white/5 rounded-tl-none text-emerald-950 dark:text-white/95'}`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed font-bold" dir="auto">
                      {mainText}
                    </p>
                    {hasTranslation && subText && (
                      <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-40 mb-0.5">
                          {originalLabel}
                        </p>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed font-medium opacity-60" dir="auto">
                          {subText}
                        </p>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] font-bold text-emerald-900/20 dark:text-white/20 mt-1.5 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
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

        {isTranslating && (
          <div className="flex items-center justify-center gap-2 py-3 bg-brand-neon/5 rounded-2xl border border-brand-neon/10 animate-pulse">
            <Loader2 className="w-4 h-4 text-brand-neon animate-spin" />
            <span className="text-[10px] font-bold text-brand-muted dark:text-brand-neon uppercase tracking-widest">{t.chatTranslating}</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-bg-dark-900/50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-400 rounded-2xl shadow-sm">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t.chatInputPlaceholder}
            disabled={isTranslating}
            dir="auto"
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-200 dark:border-white/10 
                       bg-white dark:bg-bg-dark-950 text-brand-dark dark:text-white/95 text-sm
                       focus:ring-1 focus:ring-brand-neon focus:border-brand-neon
                       placeholder-emerald-900/20 dark:placeholder-white/10 disabled:opacity-50 transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isTranslating}
            className="w-12 h-12 flex items-center justify-center bg-brand-neon text-brand-dark rounded-2xl shadow-lg shadow-brand-neon/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
          >
            {isTranslating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
