import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { Send, Languages, Loader2 } from 'lucide-react';
import type { ChatMessage, ParticipantRole } from '@/types';

interface ChatPanelProps {
  myId: string;
  myName: string;
  myRole: ParticipantRole;
  myLanguage: string;
  partnerLanguage: string;
  onSendMessage?: (message: ChatMessage) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ 
  myId, 
  myName, 
  myRole, 
  myLanguage, 
  partnerLanguage,
  onSendMessage 
}: ChatPanelProps) {
  const { chatMessages } = useRoomStore();
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);
  
  const [message, setMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uniqueMessages = chatMessages.filter(
    (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [uniqueMessages.length]);

  const isSendingRef = useRef(false);

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

      if (autoTranslate && myLanguage !== partnerLanguage) {
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
          console.error('Translation error:', err);
        }
        setIsTranslating(false);
      }

      onSendMessage?.(chatMessage);
    } finally {
      isSendingRef.current = false;
    }
  }, [message, isTranslating, myId, myName, myRole, myLanguage, partnerLanguage, autoTranslate, translateViaServer, onSendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-dark-900">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-dark dark:text-white/95">{t.chatTitle}</h3>
        <button
          onClick={() => setAutoTranslate(!autoTranslate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
            autoTranslate
              ? 'bg-brand-neon/20 text-brand-muted dark:text-brand-neon'
              : 'bg-gray-100 dark:bg-white/5 text-emerald-900/40 dark:text-white/30'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          {t.chatAutoTranslate}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {uniqueMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.chatEmpty}</p>
            <p className="text-xs text-center mt-1 text-emerald-900/20 dark:text-white/10">{t.chatStart}</p>
          </div>
        ) : (
          uniqueMessages.map((msg) => {
            const isMe = msg.senderId === myId;
            const hasTranslation = msg.translatedText && msg.translatedText !== msg.text;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className={`text-[11px] mb-1.5 font-black ${msg.senderRole === 'host' ? 'text-brand-muted dark:text-brand-neon' : 'text-emerald-700/60 dark:text-white/50'}`}>
                  {msg.senderName}
                </span>

                <div className={`max-w-[85%] rounded-2xl overflow-hidden shadow-sm ${isMe ? 'bg-brand-neon rounded-tr-none' : 'bg-gray-100 dark:bg-white/5 rounded-tl-none'}`}>
                  <div className="px-4 py-3">
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed font-medium ${isMe ? 'text-brand-dark' : 'text-emerald-950 dark:text-white/95'}`} dir="auto">
                      {msg.text}
                    </p>
                  </div>

                  {hasTranslation && (
                    <div className={`px-4 py-3 border-t ${isMe ? 'bg-black/5 border-black/5' : 'bg-black/5 dark:bg-white/5 border-white/5'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isMe ? 'text-brand-dark/40' : 'text-brand-muted/40 dark:text-white/30'}`}>
                        {t.chatTranslationLabel}
                      </p>
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed font-semibold ${isMe ? 'text-brand-dark/90' : 'text-brand-muted dark:text-brand-neon'}`} dir="auto">
                        {msg.translatedText}
                      </p>
                    </div>
                  )}
                </div>

                <span className="text-[9px] font-bold text-emerald-900/20 dark:text-white/20 mt-1.5 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}

        {isTranslating && (
          <div className="flex items-center justify-center gap-2 py-3 bg-brand-neon/5 rounded-2xl border border-brand-neon/10 animate-pulse">
            <Loader2 className="w-4 h-4 text-brand-neon animate-spin" />
            <span className="text-[10px] font-bold text-brand-muted dark:text-brand-neon uppercase tracking-widest">{t.chatTranslating}</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-bg-dark-900/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.chatInputPlaceholder}
            disabled={isTranslating}
            dir="auto"
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-200 dark:border-white/10 
                       bg-white dark:bg-bg-dark-950 text-brand-dark dark:text-white/95 text-sm
                       focus:ring-1 focus:ring-brand-neon focus:border-brand-neon
                       placeholder-emerald-900/20 dark:placeholder-white/10 disabled:opacity-50 transition-all"
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
