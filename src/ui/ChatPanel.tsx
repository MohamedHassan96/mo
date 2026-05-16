import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useRoomStore } from '@/state/roomStore';
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
  return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
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
  const [message, setMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // إزالة المكرر بناءً على الـ id
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
      // إنشاء رسالة واحدة فقط تحتوي على النص الأصلي والمترجم
      const chatMessage: ChatMessage = {
        id: uuid(),
        senderId: myId,
        senderName: myName,
        senderRole: myRole,
        text: messageText,
        timestamp: Date.now(),
      };

      // إذا كانت الترجمة التلقائية مفعلة واللغات مختلفة
      if (autoTranslate && myLanguage !== partnerLanguage) {
        setIsTranslating(true);
        try {
          const translatedText = await translateViaServer(
            messageText,
            myLanguage,
            partnerLanguage
          );

          // رسالة واحدة تحتوي على الأصل والترجمة
          chatMessage.translatedText = translatedText;
          chatMessage.originalLanguage = myLanguage;
          chatMessage.translatedLanguage = partnerLanguage;
        } catch (err) {
          console.error('Translation error:', err);
        }
        setIsTranslating(false);
      }

      // الأب (RoomPage) هو المسؤول عن إضافة الرسالة للمتجر وإرسالها للطرف الآخر
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">الدردشة</h3>
        <button
          onClick={() => setAutoTranslate(!autoTranslate)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            autoTranslate
              ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          ترجمة تلقائية
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {uniqueMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm text-center">
              لا توجد رسائل بعد
            </p>
            <p className="text-xs text-center mt-1 opacity-75">
              ابدأ المحادثة!
            </p>
          </div>
        ) : (
          uniqueMessages.map((msg) => {
            const isMe = msg.senderId === myId;
            const hasTranslation = msg.translatedText && msg.translatedText !== msg.text;
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* اسم المرسل */}
                <span className={`text-xs mb-1 font-medium ${
                  msg.senderRole === 'host'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {msg.senderName}
                </span>

                {/* فقاعة الرسالة */}
                <div
                  className={`max-w-[85%] rounded-2xl overflow-hidden ${
                    isMe
                      ? 'bg-indigo-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  {/* النص الأصلي */}
                  <div className="px-4 py-2.5">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">
                      {msg.text}
                    </p>
                  </div>

                  {/* الترجمة (إن وجدت) */}
                  {hasTranslation && (
                    <div className={`px-4 py-2.5 border-t ${
                      isMe 
                        ? 'bg-indigo-600/50 border-indigo-400/30' 
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className={`text-xs mb-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                        الترجمة:
                      </p>
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                        isMe ? 'text-indigo-100' : 'text-gray-600 dark:text-gray-300'
                      }`} dir="auto">
                        {msg.translatedText}
                      </p>
                    </div>
                  )}
                </div>

                {/* الوقت */}
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}

        {isTranslating && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
            <span className="text-xs text-gray-400">جاري الترجمة...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="اكتب رسالة..."
            disabled={isTranslating}
            dir="auto"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 
                       bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isTranslating}
            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 
                       dark:disabled:bg-gray-700 text-white rounded-xl transition-colors
                       disabled:cursor-not-allowed"
          >
            {isTranslating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
