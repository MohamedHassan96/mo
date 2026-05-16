import { Mic, MicOff, Loader2 } from 'lucide-react';
import type { ProcessingStatus } from '@/types';

interface MicStatusIndicatorProps {
  isRecording: boolean;
  volume: number;
  processingStatus: ProcessingStatus;
}

export default function MicStatusIndicator({
  isRecording,
  processingStatus,
}: MicStatusIndicatorProps) {
  const getStatusColor = () => {
    switch (processingStatus.stage) {
      case 'listening': return 'text-brand-muted dark:text-brand-neon';
      case 'transcribing': return 'text-brand-dark dark:text-white/80';
      case 'translating': return 'text-emerald-700 dark:text-brand-neon';
      case 'synthesizing': return 'text-brand-dark dark:text-white/80';
      case 'playing': return 'text-brand-muted dark:text-brand-neon';
      case 'error': return 'text-red-600';
      default: return 'text-emerald-900/40 dark:text-white/30';
    }
  };

  const getStatusLabel = () => {
    if (processingStatus.stage === 'synthesizing') {
      return processingStatus.message || '🔊 الطرف الآخر يتحدث...';
    }
    switch (processingStatus.stage) {
      case 'idle': return 'جاهز';
      case 'listening': return '🎤 يستمع...';
      case 'transcribing': return '📝 يكتب...';
      case 'translating': return '🌐 يترجم...';
      case 'playing': return '▶️ يشغل...';
      case 'error': return '❌ خطأ';
      default: return '';
    }
  };

  const isProcessing = ['transcribing', 'translating', 'synthesizing'].includes(processingStatus.stage);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white/80 dark:bg-bg-dark-900/80 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm rounded-xl">
      {/* Mic icon */}
      <div className="relative">
        {isRecording ? (
          <Mic className={`w-4 h-4 ${getStatusColor()}`} />
        ) : (
          <MicOff className="w-4 h-4 text-gray-500" />
        )}
        {isRecording && processingStatus.stage === 'listening' && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping" />
        )}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <Loader2 className={`w-3.5 h-3.5 animate-spin ${getStatusColor()}`} />
      )}

      {/* Status text */}
      <span className={`text-xs font-bold ${getStatusColor()}`}>
        {isProcessing 
          ? getStatusLabel() 
          : (isRecording ? getStatusLabel() : 'الميكروفون مغلق')}
      </span>

      {/* Interim text preview */}
      {processingStatus.stage === 'transcribing' && processingStatus.message && (
        <span className="text-xs text-gray-500 dark:text-[#A3A3A3] truncate max-w-[150px] font-medium">
          "{processingStatus.message}"
        </span>
      )}
    </div>
  );
}
