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
    <div className="flex flex-col h-full bg-white dark:bg-bg-dark-900">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-brand-neon" />
          <h3 className="text-sm font-bold text-brand-dark dark:text-white/95">{t.transcriptTitle}</h3>
        </div>
        {uniqueTranscripts.length > 0 && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-dark dark:text-brand-neon transition-colors font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            {t.transcriptExportBtn}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {uniqueTranscripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-3xl bg-brand-neon/5 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-brand-muted/20 dark:text-brand-neon/20" />
            </div>
            <p className="text-sm text-center font-bold text-emerald-900/40 dark:text-white/30">{t.transcriptEmpty}</p>
            <p className="text-xs mt-1 text-center text-emerald-900/20 dark:text-white/10">{t.transcriptStart}</p>
          </div>
        ) : (
          uniqueTranscripts.map((entry) => {
            const isMe = entry.speakerId === myId;
            const hasTranslation = !isMe && entry.translatedText && entry.translatedText !== entry.originalText;

            return (
              <div key={entry.id} className={`flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-[11px] font-black ${entry.speakerRole === 'host' ? 'text-brand-muted dark:text-brand-neon' : 'text-emerald-700/60 dark:text-white/50'}`}>
                    {entry.speakerName}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-900/20 dark:text-white/20">{formatTime(entry.timestamp)}</span>
                </div>

                <div className={`max-w-[90%] rounded-2xl overflow-hidden shadow-sm ${isMe ? 'bg-brand-neon rounded-tr-none' : 'bg-gray-100 dark:bg-white/5 rounded-tl-none'}`}>
                  <div className="px-4 py-3">
                    <span className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${isMe ? 'text-brand-dark/40' : 'text-brand-muted/40 dark:text-white/30'}`}>
                      {getLanguageName(entry.originalLanguage)}
                    </span>
                    <p className={`text-sm leading-relaxed font-medium ${isMe ? 'text-brand-dark' : 'text-emerald-950 dark:text-white/95'}`} dir={getLanguageDirection(entry.originalLanguage)}>
                      {entry.originalText}
                    </p>
                  </div>

                  {hasTranslation && (
                    <div className="border-t border-black/5 dark:border-white/5">
                      <div className={`flex items-center gap-1.5 px-4 py-1.5 ${isMe ? 'bg-black/5' : 'bg-black/5 dark:bg-white/5'}`}>
                        <ArrowDown className={`w-3 h-3 ${isMe ? 'text-brand-dark/30' : 'text-brand-muted/30 dark:text-white/20'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-brand-dark/30' : 'text-brand-muted/30 dark:text-white/20'}`}>
                          {getLanguageName(entry.translatedLanguage)}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <p className={`text-sm leading-relaxed font-semibold ${isMe ? 'text-brand-dark/90' : 'text-brand-muted dark:text-brand-neon'}`} dir={getLanguageDirection(entry.translatedLanguage)}>
                          {entry.translatedText}
                        </p>
                      </div>
                    </div>
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
