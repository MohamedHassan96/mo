import { useEffect, useRef } from 'react';
import { getLanguageName, getLanguageDirection } from '@/config/languages';
import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { Download, FileText, Volume2, ArrowDown } from 'lucide-react';
import type { TranscriptEntry } from '@/types';

interface TranscriptPanelProps {
  transcripts: TranscriptEntry[];
  myId: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TranscriptPanel({ transcripts, myId }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);

  const uniqueTranscripts = transcripts.filter(
    (entry, index, self) => index === self.findIndex((e) => e.id === entry.id)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [uniqueTranscripts.length]);

  const handleDownload = () => {
    const lines = uniqueTranscripts.map((entry) => {
      const time = formatTime(entry.timestamp);
      return `[${time}] ${entry.speakerName}\n  ${getLanguageName(entry.originalLanguage)}: ${entry.originalText}\n  ${getLanguageName(entry.translatedLanguage)}: ${entry.translatedText}\n`;
    });
    const content = `TalkBridge Transcript\n${'='.repeat(50)}\nDate: ${new Date().toLocaleDateString()}\n\n${lines.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talkbridge-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1E1E1E]">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-[#006494]" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t.transcriptTitle}</h3>
        </div>
        {uniqueTranscripts.length > 0 && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-xs text-[#006494] hover:text-[#004a70] transition-colors font-bold"
            title={t.transcriptExportTooltip}
          >
            <Download className="w-3.5 h-3.5" />
            {t.transcriptExportBtn}
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {uniqueTranscripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm text-center font-bold">{t.transcriptEmpty}</p>
            <p className="text-xs mt-1 text-center opacity-75">{t.transcriptStart}</p>
          </div>
        ) : (
          uniqueTranscripts.map((entry) => {
            const isMe = entry.speakerId === myId;
            const hasTranslation = !isMe && entry.translatedText && entry.translatedText !== entry.originalText;

            return (
              <div
                key={entry.id}
                className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Speaker & time */}
                <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`text-xs font-bold ${
                      entry.speakerRole === 'host'
                        ? 'text-[#006494]'
                        : 'text-emerald-500'
                    }`}
                  >
                    {entry.speakerName}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatTime(entry.timestamp)}</span>
                </div>

                {/* Bubble — original + translation in same container */}
                <div
                  className={`max-w-[90%] rounded-2xl overflow-hidden shadow-sm ${
                    isMe
                      ? 'bg-[#006494] rounded-br-md'
                      : 'bg-gray-100 dark:bg-[#1E1E1E] rounded-bl-md'
                  }`}
                >
                  {/* النص الأصلي */}
                  <div className="px-4 pt-3 pb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                        isMe ? 'text-white/60' : 'text-gray-400 dark:text-[#A3A3A3]'
                      }`}
                    >
                      {getLanguageName(entry.originalLanguage)}
                    </span>
                    <p
                      className={`text-sm leading-relaxed font-medium ${
                        isMe ? 'text-white' : 'text-gray-900 dark:text-white'
                      }`}
                      dir={getLanguageDirection(entry.originalLanguage)}
                    >
                      {entry.originalText}
                    </p>
                  </div>

                  {/* الترجمة — تظهر فقط إذا كانت مختلفة */}
                  {hasTranslation && (
                    <>
                      {/* فاصل بسهم */}
                      <div
                        className={`flex items-center gap-1 px-4 py-0.5 ${
                          isMe
                            ? 'bg-[#002e47]lack/10'
                            : 'bg-gray-200/60 dark:bg-white/5'
                        }`}
                      >
                        <ArrowDown
                          className={`w-3 h-3 ${isMe ? 'text-white/50' : 'text-gray-400'}`}
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isMe ? 'text-white/50' : 'text-gray-400 dark:text-[#A3A3A3]'
                          }`}
                        >
                          {getLanguageName(entry.translatedLanguage)}
                        </span>
                      </div>
                      <div className="px-4 pt-2 pb-3">
                        <p
                          className={`text-sm leading-relaxed ${
                            isMe
                              ? 'text-white/90'
                              : 'text-gray-600 dark:text-[#D9D9D9]'
                          }`}
                          dir={getLanguageDirection(entry.translatedLanguage)}
                        >
                          {entry.translatedText}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
