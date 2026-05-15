import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceActivityRecorderOptions {
  stream: MediaStream | null;
  onSpeechEnd: (audioBase64: string) => void;
  onSpeechStart?: () => void;
  silenceDelay?: number;
  minDecibels?: number;
}

export function useVoiceActivityRecorder({
  stream,
  onSpeechEnd,
  onSpeechStart,
  silenceDelay = 1500,
  minDecibels = -50,
}: UseVoiceActivityRecorderOptions) {
  const [isListening, setIsListening] = useState(false);

  // All mutable state in refs – avoids stale closures
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef          = useRef<BlobPart[]>([]);
  const audioContextRef    = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const isSpeakingRef      = useRef(false);
  const silenceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRecordTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef             = useRef<number | null>(null);
  const isActiveRef        = useRef(false);   // true while VAD loop should run

  // Always-fresh refs for callback & stream
  const onSpeechEndRef  = useRef(onSpeechEnd);
  const onSpeechStartRef = useRef(onSpeechStart);
  const streamRef        = useRef(stream);
  useEffect(() => { onSpeechEndRef.current  = onSpeechEnd;  }, [onSpeechEnd]);
  useEffect(() => { onSpeechStartRef.current = onSpeechStart; }, [onSpeechStart]);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  const teardown = useCallback(() => {
    isActiveRef.current = false;

    if (rafRef.current)          { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxRecordTimerRef.current){ clearTimeout(maxRecordTimerRef.current); maxRecordTimerRef.current = null; }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    isSpeakingRef.current = false;
    // تم إزالة chunksRef.current = [] من هنا عشان ما يضيعش آخر تسجيل
  }, []);

  // ── stopListening ──────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    setIsListening(false);
    teardown();
  }, [teardown]);

  // ── startListening ─────────────────────────────────────────────────────────
  const startListening = useCallback((optionalStream?: MediaStream | null) => {
    const activeStream = optionalStream ?? streamRef.current;
    if (!activeStream) {
      console.warn('[VAD] No stream available');
      return;
    }

    // Tear down any previous session first
    teardown();

    // Check mimeType support
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source  = audioCtx.createMediaStreamSource(activeStream);
      const analyser = audioCtx.createAnalyser();
      analyser.minDecibels       = minDecibels;
      analyser.smoothingTimeConstant = 0.3;
      analyser.fftSize           = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = mimeType
        ? new MediaRecorder(activeStream, { mimeType })
        : new MediaRecorder(activeStream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const chunks = chunksRef.current.splice(0); // drain & reset
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 300) return; // ignore tiny / silent blobs, reduced from 1000 to 300 to not drop short phrases

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (result?.includes(',')) {
            onSpeechEndRef.current(result.split(',')[1]);
          }
        };
        reader.readAsDataURL(blob);
      };

      const bufferLength = analyser.frequencyBinCount;
      const dataArray    = new Uint8Array(bufferLength);
      isActiveRef.current = true;
      setIsListening(true);

      const loop = () => {
        if (!isActiveRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((s, v) => s + v, 0) / bufferLength;

        if (avg > 15) {
          // ── Voice detected ────────────────────────────────────────
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            if (mediaRecorderRef.current?.state === 'inactive') {
              mediaRecorderRef.current.start(100); // timeslice = 100ms chunks
              // Safety cut at 7 s
              if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
              maxRecordTimerRef.current = setTimeout(() => {
                isSpeakingRef.current = false;
                if (maxRecordTimerRef.current) { clearTimeout(maxRecordTimerRef.current); maxRecordTimerRef.current = null; }
                if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
              }, 7000);
            }
            onSpeechStartRef.current?.();
          }
        } else {
          // ── Silence detected ──────────────────────────────────────
          if (isSpeakingRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              isSpeakingRef.current  = false;
              if (maxRecordTimerRef.current) { clearTimeout(maxRecordTimerRef.current); maxRecordTimerRef.current = null; }
              if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
            }, silenceDelay);
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
      console.log('[VAD] Started listening');
    } catch (err) {
      console.error('[VAD] Setup failed:', err);
      setIsListening(false);
    }
  }, [teardown, minDecibels, silenceDelay]);

  // Cleanup on unmount
  useEffect(() => () => teardown(), [teardown]);

  return {
    isListening,
    isSupported: true,
    startListening,
    stopListening,
  };
}
