import { useState, useEffect, useRef, useCallback } from 'react';
import { useConfigStore } from '@/state/configStore';
import { transcribeAudio } from '@/services/stt';
import { translateText } from '@/services/translate';
import { synthesizeSpeech } from '@/services/tts';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/config/languages';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Upload,
  Sparkles,
  ArrowRight,
  Cpu,
  Key,
  Volume2,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  RefreshCw,
  FileAudio,
  Radio,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export default function VoicePlayground() {
  const { config, theme, uiLanguage } = useConfigStore();
  const { groqApiKey, elevenLabsApiKey, elevenLabsVoiceId, geminiApiKey } = config;

  // Language & Translation states
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ar');
  const [translationStyle, setTranslationStyle] = useState<'slang' | 'natural' | 'formal'>('slang');

  // Audio Recording & File Upload States
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Output States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'transcribing' | 'translating' | 'synthesizing' | 'done'>('idle');
  const [transcription, setTranscription] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [outputAudioBlob, setOutputAudioBlob] = useState<Blob | null>(null);
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);
  const [isPlayingOutput, setIsPlayingOutput] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  // Visualizer / Wave states
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(30).fill(5));
  
  // Pipeline Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);

  // Add a custom log entry
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + `.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setLogs((prev) => [{ timestamp: timeStr, type, message }, ...prev].slice(0, 100));
  }, []);

  // Initialize with helpful info logs
  useEffect(() => {
    addLog('مرحبا بك في لوحة تحويل وترجمة الصوت الاحترافية!', 'info');
    addLog(`Groq API Key: ${groqApiKey ? `مُفعل (...${groqApiKey.slice(-6)})` : 'غير مُفعل'}`, groqApiKey ? 'success' : 'warning');
    addLog(`ElevenLabs API Key: ${elevenLabsApiKey ? `مُفعل (...${elevenLabsApiKey.slice(-6)})` : 'غير مُفعل'}`, elevenLabsApiKey ? 'success' : 'warning');
    addLog(`ElevenLabs Voice ID (صوت مصري): ${elevenLabsVoiceId || 'c06fdbaa06e04b6cbe80fb460336f064'}`, 'success');
  }, [groqApiKey, elevenLabsApiKey, elevenLabsVoiceId, addLog]);

  // Clean up URL objects on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (outputAudioUrl) URL.revokeObjectURL(outputAudioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceStreamRef.current) sourceStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [audioUrl, outputAudioUrl]);

  // Update visual levels from analyser
  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isRecording) return;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
    
    // Subsample frequency data to 30 bars
    const rawData = Array.from(dataArrayRef.current);
    const step = Math.floor(rawData.length / 30);
    const subLevels = Array.from({ length: 30 }, (_, i) => {
      const start = i * step;
      const sum = rawData.slice(start, start + step).reduce((acc, val) => acc + val, 0);
      const avg = sum / step;
      // Map 0-255 range to 4px-64px heights
      return Math.max(5, Math.min(60, (avg / 255) * 60 + 5));
    });
    
    setAudioLevels(subLevels);
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [isRecording]);

  // Handle Voice Recording
  const startRecording = async () => {
    try {
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setRecordingTime(0);
      setAudioLevels(new Array(30).fill(5));

      addLog('جاري الوصول للميكروفون...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      sourceStreamRef.current = stream;

      // Set up Audio Analyser for visualization
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 64; // Small fft size for basic frequencies
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Media recorder config
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        addLog(`تم حفظ تسجيل الصوت الخام! الحجم: ${(finalBlob.size / 1024).toFixed(1)} KB`, 'success');
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== 'closed') audioContext.close();
      };

      recorder.start();
      setIsRecording(true);
      addLog('بدأ تسجيل الصوت الخام... تحدث الآن 🎤', 'info');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Trigger visualizer loop
      animationFrameRef.current = requestAnimationFrame(() => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
        updateVisualizer();
      });

    } catch (err: any) {
      console.error(err);
      addLog(`فشل الوصول للميكروفون: ${err.message}`, 'error');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    addLog('تم إيقاف التسجيل وتجهيز عينات الصوت الخام.', 'info');
  };

  // Drag and drop audio uploads
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        setAudioBlob(file);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(file));
        addLog(`تم تحميل ملف صوتي: "${file.name}" | الحجم: ${(file.size / 1024).toFixed(1)} KB`, 'success');
      } else {
        addLog('الملف المرفوع ليس ملفًا صوتيًا صالحًا!', 'error');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioBlob(file);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(file));
      addLog(`تم اختيار ملف صوتي: "${file.name}" | الحجم: ${(file.size / 1024).toFixed(1)} KB`, 'success');
    }
  };

  // The Magic Core AI Audio Translation Pipeline
  const runVoicePipeline = async () => {
    if (!audioBlob) {
      addLog('الرجاء تسجيل صوت أو رفع ملف صوتي أولاً!', 'warning');
      return;
    }

    setIsProcessing(true);
    setTranscription('');
    setTranslatedText('');
    setOutputAudioBlob(null);
    if (outputAudioUrl) {
      URL.revokeObjectURL(outputAudioUrl);
      setOutputAudioUrl(null);
    }

    try {
      // 1. Transcription (Speech-to-Text via Groq Whisper)
      setProcessingStage('transcribing');
      addLog('الخطوة 1: جاري إرسال الصوت الخام إلى Groq Whisper للتعرف على الكلام...', 'info');
      
      const sttKey = groqApiKey || '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';
      
      const sttResult = await transcribeAudio(audioBlob, sttKey, sourceLang);
      
      if (!sttResult.text || sttResult.text.trim().length === 0) {
        throw new Error('فشل Groq Whisper في استخراج أي كلام مسموع من التسجيل.');
      }
      
      setTranscription(sttResult.text);
      addLog(`تم التعرف على النص بنجاح: "${sttResult.text}"`, 'success');

      // 2. Translation via Slang-aware prompts (Groq Llama 3 / Gemini)
      setProcessingStage('translating');
      addLog(`الخطوة 2: جاري ترجمة النص مع مراعاة اللهجة العامية (${sourceLang} -> ${targetLang})...`, 'info');
      
      const sourceLangName = getLanguageByCode(sourceLang)?.name || sourceLang;
      const targetLangName = getLanguageByCode(targetLang)?.name || targetLang;

      // Custom system prompts to inject slang and conversational premium features
      let slangGuidelines = '';
      if (translationStyle === 'slang') {
        if (targetLang === 'ar') {
          slangGuidelines = `FOR ARABIC (Target): Use deep Egyptian white/street Arabic slang. Use highly conversational premium phrases like: "إزيك يا صاحبي", "عامل إيه", "قشطة", "فل وتمام", "ماشي يا كبير", "يا باشا", "يا وحش", "على وضعه", "تسلملي يا غالي", "حبيبي". Avoid MSA like "كيف حالك" or "حسناً". Make it flow like a real Egyptian friend talking.`;
        } else if (targetLang === 'en') {
          slangGuidelines = `FOR ENGLISH (Target): Use natural street/casual slang. Use high-end conversational terms like: "What's up bro", "How's it going", "That's legit", "I'm down for that", "No worries", "Gotcha", "Solid", "Legit", "Man". Avoid robotic translation.`;
        }
      } else if (translationStyle === 'natural') {
        slangGuidelines = `Use highly natural, warm, friendly conversational tone. No standard stiff textbook phrases. Avoid robotic translations.`;
      } else {
        slangGuidelines = `Use professional, elegant, sophisticated, and polished language suitable for business meetings or expert consultations.`;
      }

      // Add a customized translate service proxy here to ensure custom prompts
      const transKey = groqApiKey || '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';
      
      // Let's create an explicit local fetch call to Groq Llama3 70B to fully enforce the user's specific premium requirements!
      const systemPrompt = `You are a strict, professional slang-aware real-time voice translator bridge.
Translate from ${sourceLangName} to ${targetLangName}.

RULES:
1. Return ONLY the direct translation. No explanations, no notes, no quotes.
2. Maintain the EXACT feeling, emotion, intensity, and slang of the speaker.
3. ${slangGuidelines}

EXAMPLES:
- "Hello my friend, how are you doing?" -> "إيه الكلام يا صاحبي عامل إيه؟"
- "This is absolutely incredible!" -> "ده على وضعه والله وجامد جداً"
- "I don't really care" -> "فكك مني يا عم مش فارق"
- "Take care, talk to you later" -> "خلي بالك من نفسك يا بطل ونتكلم بعدين"`;

      addLog('جاري الاتصال بـ Llama 3.3 70B (عبر Groq) للحصول على أفضل صياغة طبيعية للمحادثة...', 'info');
      
      const translationResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${transKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sttResult.text }
          ],
          temperature: 0.1
        })
      });

      let finalTranslation = '';
      if (translationResponse.ok) {
        const data = await translationResponse.json();
        finalTranslation = data.choices?.[0]?.message?.content?.trim() || '';
      } else {
        addLog('فشل اتصال Groq Llama، جاري استخدام محرك الترجمة المدمج كبديل...', 'warning');
        const fallbackRes = await translateText(sttResult.text, sourceLang, targetLang, transKey);
        finalTranslation = fallbackRes.translatedText;
      }

      if (!finalTranslation) {
        throw new Error('لم يتمكن محرك الترجمة من صياغة النص المترجم.');
      }

      // Clean up common translation prefixes
      finalTranslation = finalTranslation
        .replace(/^["'«»]|["'«»]$/g, '')
        .replace(/^(Translation|Translated text|الترجمة|ترجمة)\s*:\s*/i, '')
        .trim();

      setTranslatedText(finalTranslation);
      addLog(`الترجمة الاحترافية الصادرة: "${finalTranslation}"`, 'success');

      // 3. Synthesis (Text-to-Speech via ElevenLabs)
      setProcessingStage('synthesizing');
      addLog(`الخطوة 3: جاري تصدير الصوت الاحترافي عبر ElevenLabs...`, 'info');
      
      const ttsKey = elevenLabsApiKey || 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056';
      const voiceId = elevenLabsVoiceId || 'c06fdbaa06e04b6cbe80fb460336f064'; // Egyptian Arabic Premium Voice
      
      addLog(`استخدام معرف الصوت المخصص: ${voiceId} (صوت مصري بشري طبيعي)`, 'info');

      // Synthesize Speech
      const speechBlob = await synthesizeSpeech({
        text: finalTranslation,
        language: targetLang,
        provider: 'elevenlabs',
        elevenLabsApiKey: ttsKey,
        elevenLabsVoiceId: voiceId
      });

      if (!speechBlob) {
        throw new Error('ElevenLabs failed to return audio blob');
      }

      setOutputAudioBlob(speechBlob);
      const outputUrl = URL.createObjectURL(speechBlob);
      setOutputAudioUrl(outputUrl);
      
      addLog(`نجحت المعالجة كاملة! تم توليد ملف صوتي احترافي بصوت طبيعي. الحجم: ${(speechBlob.size / 1024).toFixed(1)} KB`, 'success');
      setProcessingStage('done');

      // Auto play the translated professional voice
      setTimeout(() => {
        if (outputAudioRef.current) {
          outputAudioRef.current.play()
            .then(() => setIsPlayingOutput(true))
            .catch(e => console.warn('Autoplay prevented:', e));
        }
      }, 500);

    } catch (err: any) {
      console.error(err);
      addLog(`حدث خطأ أثناء معالجة خط الأنابيب: ${err.message}`, 'error');
      setProcessingStage('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  // Audio Playback Controls
  const togglePlayOutput = () => {
    if (!outputAudioRef.current) return;

    if (isPlayingOutput) {
      outputAudioRef.current.pause();
      setIsPlayingOutput(false);
    } else {
      outputAudioRef.current.play()
        .then(() => setIsPlayingOutput(true))
        .catch(e => addLog(`تعذر تشغيل الصوت: ${e.message}`, 'error'));
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaySpeed(speed);
    if (outputAudioRef.current) {
      outputAudioRef.current.defaultPlaybackRate = speed;
      outputAudioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteRawAudio = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setTranscription('');
    setTranslatedText('');
    setOutputAudioBlob(null);
    if (outputAudioUrl) {
      URL.revokeObjectURL(outputAudioUrl);
      setOutputAudioUrl(null);
    }
    setProcessingStage('idle');
    addLog('تم مسح جميع الملفات والبيانات المسجلة بنجاح.', 'info');
  };

  const sourceLangDir = getLanguageByCode(sourceLang)?.direction || 'ltr';
  const targetLangDir = getLanguageByCode(targetLang)?.direction || 'ltr';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up select-none" dir="rtl">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-2">
            <Radio className="w-3.5 h-3.5 text-brand-neon animate-pulse" />
            <span className="text-[10px] font-black text-brand-muted dark:text-brand-neon uppercase tracking-widest">
              AI Voice Engine Framework
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
            مترجم ومطور الصوت الذكي الاحترافي
          </h2>
          <p className="text-sm text-emerald-900/60 dark:text-white/60 font-medium mt-1">
            سجل صوتك العفوي (الخام) وحوّله في ثوانٍ إلى صوت احترافي ومترجم بأرقى أصوات الذكاء الاصطناعي الطبيعية.
          </p>
        </div>
        
        {/* API keys status board */}
        <div className="w-full md:w-auto p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-neon" />
            <span className="text-xs font-black text-gray-900 dark:text-white/80">حالة الربط البرمجي:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${groqApiKey ? 'bg-brand-neon' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-bold text-gray-700 dark:text-white/60">
              Whisper STT & Llama 3 {groqApiKey ? '(نشط)' : '(مفتاح افتراضي)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${elevenLabsApiKey ? 'bg-brand-neon' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-bold text-gray-700 dark:text-white/60">
              ElevenLabs Voice {elevenLabsApiKey ? '(نشط)' : '(مفتاح افتراضي)'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Steps (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* STEP 1: Capture Raw Audio */}
          <div className="p-6 sm:p-8 rounded-[32px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon opacity-[0.03] rounded-full blur-2xl" />
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center font-bold text-brand-muted dark:text-brand-neon">
                  01
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white/95">التقاط الصوت الخام (Raw Audio Input)</h3>
                  <p className="text-xs text-gray-400 dark:text-white/40">سجل صوتك مباشرة أو ارفع ملفًا صوتياً من جهازك.</p>
                </div>
              </div>
              
              {audioBlob && (
                <button
                  onClick={deleteRawAudio}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                  title="حذف وحذف البيانات"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Language selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-gray-500 dark:text-white/40">لغة المتحدث (اللغة الأصلية):</span>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark-950 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white/90 outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-gray-500 dark:text-white/40">لغة الترجمة الصوتية (الهدف):</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-dark-950 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white/90 outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Input Audio Interface */}
            {!audioBlob ? (
              <div 
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                  dragActive 
                    ? 'border-brand-neon bg-brand-neon/5' 
                    : 'border-gray-200 dark:border-white/10 hover:border-brand-neon/30 bg-gray-50/50 dark:bg-white/1'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {isRecording ? (
                  /* Recording Panel */
                  <div className="flex flex-col items-center">
                    {/* Live Waveform CSS animation */}
                    <div className="flex items-end gap-1.5 h-16 mb-4">
                      {audioLevels.map((height, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-brand-neon rounded-full transition-all duration-75"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                    
                    <span className="text-lg font-black text-gray-900 dark:text-white animate-pulse">
                      جاري تسجيل كلامك العفوي...
                    </span>
                    <span className="text-xs text-red-500 font-mono mt-1 font-bold">
                      {formatTime(recordingTime)}
                    </span>
                    
                    <button
                      onClick={stopRecording}
                      className="mt-6 flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:-translate-y-0.5 transition-all"
                    >
                      <MicOff className="w-4 h-4 animate-bounce" />
                      إيقاف وحفظ التسجيل
                    </button>
                  </div>
                ) : (
                  /* Idle Panel */
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center mb-4 text-brand-muted dark:text-brand-neon">
                      <Mic className="w-8 h-8" />
                    </div>
                    
                    <p className="text-sm font-black text-gray-700 dark:text-white/80">
                      اضغط زر البدء للتحدث مباشرة بالميكروفون
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                      أو اسحب وأسقط أي ملف صوتي هنا
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-3 justify-center">
                      <button
                        onClick={startRecording}
                        className="flex items-center gap-2 px-6 py-3.5 bg-brand-neon text-brand-dark rounded-xl font-black shadow-lg shadow-brand-neon/20 hover:shadow-brand-neon/40 hover:-translate-y-0.5 transition-all"
                      >
                        <Mic className="w-4 h-4" />
                        ابدأ التسجيل الحي
                      </button>
                      
                      <label className="flex items-center gap-2 px-5 py-3.5 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-white/80 border border-gray-200 dark:border-white/10 rounded-xl font-bold cursor-pointer transition-all">
                        <Upload className="w-4 h-4" />
                        <span>اختر ملف صوتي</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Audio Recorded / Uploaded panel */
              <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-xl bg-brand-neon/20 border border-brand-neon/30 flex items-center justify-center text-brand-muted dark:text-brand-neon shrink-0">
                    <FileAudio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="text-start min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                      صوت خام جاهز للمزامنة والترجمة
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/40 font-mono mt-0.5">
                      الحجم: ${(audioBlob.size / 1024).toFixed(1)} KB | الصيغة: {audioBlob.type || 'ملف صوتي'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                  <audio src={audioUrl || ''} controls className="h-10 max-w-[200px] sm:max-w-none bg-transparent" />
                  <button
                    onClick={deleteRawAudio}
                    className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/10"
                    title="إعادة تعيين وبدء من جديد"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Configure & Translate Pipeline */}
          <div className="p-6 sm:p-8 rounded-[32px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center font-bold text-brand-muted dark:text-brand-neon">
                  02
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white/95">خيارات الصياغة الصوتية الاحترافية</h3>
                  <p className="text-xs text-gray-400 dark:text-white/40">اختر نوع الترجمة والصوت لتجعل الناتج بشرياً مذهلاً.</p>
                </div>
              </div>
            </div>

            {/* Translation Tone presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { id: 'slang', title: 'لهجة عامية شبابية', desc: 'لغة بيضاء كاجوال غنية بعبارات الشارع والترحيب اللطيف', glow: 'hover:border-brand-neon/40' },
                { id: 'natural', title: 'محادثة ودية طبيعية', desc: 'أسلوب ناعم وبسيط كأنها محادثة دافئة بين الأصدقاء مقربين', glow: 'hover:border-brand-neon/40' },
                { id: 'formal', title: 'صياغة مهنية مصقولة', desc: 'لغة رسمية فخمة وممتازة للنقاشات التقنية واجتماعات العمل', glow: 'hover:border-indigo-500/40' }
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTranslationStyle(style.id as any)}
                  className={`text-start p-4 rounded-2xl border transition-all duration-300 ${
                    translationStyle === style.id
                      ? 'border-brand-neon bg-brand-neon/5 dark:bg-brand-neon/5 shadow-md shadow-brand-neon/5'
                      : 'border-gray-200 dark:border-white/10 bg-transparent hover:bg-gray-50 dark:hover:bg-white/1 ' + style.glow
                  }`}
                >
                  <h4 className="text-sm font-black text-gray-900 dark:text-white/90 flex items-center gap-2">
                    {translationStyle === style.id && <Sparkles className="w-3.5 h-3.5 text-brand-neon" />}
                    {style.title}
                  </h4>
                  <p className="text-xs text-emerald-900/50 dark:text-white/40 mt-1 font-medium leading-relaxed">
                    {style.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Main Action Trigger */}
            <button
              onClick={runVoicePipeline}
              disabled={isProcessing || !audioBlob}
              className={`w-full flex items-center justify-center gap-3 px-8 py-5 text-lg font-black rounded-2xl shadow-xl transition-all duration-300 ${
                !audioBlob
                  ? 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/20 cursor-not-allowed border border-transparent shadow-none'
                  : isProcessing
                    ? 'bg-brand-neon/10 text-brand-muted border border-brand-neon/20 cursor-wait'
                    : 'bg-brand-neon text-brand-dark hover:shadow-brand-neon/30 hover:-translate-y-1'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {processingStage === 'transcribing' && 'جاري التعرف على الكلام عبر Whisper...'}
                    {processingStage === 'translating' && 'جاري الترجمة بـ Llama 3 وصبغها بالعامية...'}
                    {processingStage === 'synthesizing' && 'جاري تصدير الصوت البشري عبر ElevenLabs...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-brand-dark animate-pulse" />
                  <span>ترجم وعالج الصوت الخام بالذكاء الاصطناعي الآن ✨</span>
                </>
              )}
            </button>
          </div>

          {/* STEP 3: Results Board */}
          {(transcription || translatedText || outputAudioUrl || isProcessing) && (
            <div className="p-6 sm:p-8 rounded-[32px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-lg relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-neon opacity-[0.02] rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center font-bold text-brand-muted dark:text-brand-neon">
                  03
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white/95">مخرجات المعالجة الاحترافية (AI Output)</h3>
                  <p className="text-xs text-gray-400 dark:text-white/40">شاهد نصوص المحادثة واستمع إلى الصوت المصقول عالي الدقة.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                
                {/* Original Transcript Box */}
                <div className="flex flex-col p-5 rounded-2xl bg-gray-50 dark:bg-[#020910] border border-gray-200 dark:border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-emerald-950/60 dark:text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-brand-neon" />
                      النص الخام الأصلي (Groq Whisper):
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Whisper Auto-Prompted
                    </span>
                  </div>
                  
                  {isProcessing && !transcription ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-white/30 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />
                      جاري استخراج الكلام...
                    </div>
                  ) : (
                    <p 
                      className="text-base text-gray-800 dark:text-white/80 font-bold leading-relaxed text-start min-h-[80px]"
                      dir={sourceLangDir}
                    >
                      {transcription || 'في انتظار المعالجة...'}
                    </p>
                  )}
                </div>

                {/* AI Slang Translated Box */}
                <div className="flex flex-col p-5 rounded-2xl bg-lime-50/20 dark:bg-[#020f12] border border-brand-neon/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-brand-muted dark:text-brand-neon uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-neon" />
                      الصياغة المترجمة بالعامية (AI slang Llama):
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-neon/20 text-brand-muted dark:text-brand-neon border border-brand-neon/30">
                      Llama 3.3 Slang Engine
                    </span>
                  </div>

                  {isProcessing && !translatedText ? (
                    <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-white/30 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2 animate-pulse" />
                      جاري صبغ الترجمة بالعامية والتجانس المبدع...
                    </div>
                  ) : (
                    <p 
                      className="text-base text-gray-900 dark:text-brand-neon font-black leading-relaxed text-start min-h-[80px]"
                      dir={targetLangDir}
                    >
                      {translatedText || 'في انتظار صياغة المترجم...'}
                    </p>
                  )}
                </div>

              </div>

              {/* Professional Sound Player Panel */}
              {outputAudioUrl && (
                <div className="p-6 rounded-[24px] bg-brand-neon/5 dark:bg-[#031510] border border-brand-neon/20 flex flex-col md:flex-row items-center justify-between gap-6">
                  
                  {/* Left info player */}
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                      onClick={togglePlayOutput}
                      className="w-14 h-14 rounded-full bg-brand-neon text-brand-dark flex items-center justify-center shadow-lg hover:shadow-brand-neon/40 hover:scale-105 active:scale-95 transition-all shrink-0"
                    >
                      {isPlayingOutput ? (
                        <Pause className="w-6 h-6 fill-brand-dark" />
                      ) : (
                        <Play className="w-6 h-6 fill-brand-dark translate-x-[2px]" />
                      )}
                    </button>

                    <div className="text-start">
                      <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-brand-neon" />
                        صوت مصقول بالكامل وجاهز للتشغيل
                      </h4>
                      <p className="text-xs text-emerald-900/60 dark:text-white/50 font-bold mt-1">
                        صوت مخصص: {elevenLabsVoiceId ? 'معرّف خارجي نشط' : 'Egyptian Arabic premium (البشري الطبيعي)'}
                      </p>
                    </div>
                  </div>

                  {/* Playback speed & options */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    
                    {/* Playback speed toggle */}
                    <div className="flex items-center rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-1">
                      {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            playSpeed === speed
                              ? 'bg-brand-neon text-brand-dark'
                              : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white/80'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    {/* Download output file */}
                    <a
                      href={outputAudioUrl}
                      download={`Professional-AI-${targetLang}.mp3`}
                      className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/85 rounded-xl font-bold transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>تنزيل الصوت</span>
                    </a>

                  </div>

                  {/* Hidden html5 player */}
                  <audio
                    ref={outputAudioRef}
                    src={outputAudioUrl}
                    onEnded={() => setIsPlayingOutput(false)}
                    onError={() => setIsPlayingOutput(false)}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Live Logs & Developer Console (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Pro Tips / Explainer */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-start shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-neon" />
              كيف يعمل خط الأنابيب الذكي؟
            </h3>
            
            <ul className="space-y-4 text-xs font-semibold text-emerald-900/70 dark:text-white/50 leading-relaxed">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-neon/15 flex items-center justify-center text-[10px] text-brand-muted dark:text-brand-neon font-black shrink-0">1</span>
                <span>
                  <strong>التعرف بـ Whisper:</strong> نقوم بإدراج توجيه خاص باللغة المحكية (الدارجة) لتجنب الفصحى المعقدة واستخراج النص بدقة متناهية.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-neon/15 flex items-center justify-center text-[10px] text-brand-muted dark:text-brand-neon font-black shrink-0">2</span>
                <span>
                  <strong>المحاذاة بـ Llama 3:</strong> يمر النص المكتوب عبر نظام ترجمة فوري يُعطى نماذج من الأمثال وعبارات الشباب (مثل "يا صاحبي" و "على وضعه") لصياغة نص طبيعي جداً.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-neon/15 flex items-center justify-center text-[10px] text-brand-muted dark:text-brand-neon font-black shrink-0">3</span>
                <span>
                  <strong>الأداء البشري بـ ElevenLabs:</strong> باستخدام معرف الصوت المخصص <code>c06fdbaa</code>، يتم توليد مقطع صوتي نقي يحتوي على نبرة وسرعة وخامة صوت بشرية حقيقية تتكلم المصرية الأصيلة.
                </span>
              </li>
            </ul>
          </div>

          {/* Real-time developer logs console */}
          <div className="p-6 rounded-[28px] bg-gray-950 border border-white/5 shadow-2xl flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-brand-neon animate-pulse" />
                <span className="text-xs font-black text-white/90 uppercase tracking-widest font-mono">
                  Developer Live Console
                </span>
              </div>
              
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-bold text-white/30 hover:text-white/60 bg-white/5 px-2.5 py-1 rounded-lg transition-colors"
              >
                مسح السجلات
              </button>
            </div>

            {/* Logs loop */}
            <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 text-start pr-1">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs font-mono text-white/20">
                  Console is empty. Run the pipeline...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="font-mono text-[10.5px] leading-relaxed flex items-start gap-2">
                    <span className="text-white/30 shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`break-words ${
                      log.type === 'success' 
                        ? 'text-brand-neon' 
                        : log.type === 'error' 
                          ? 'text-red-500' 
                          : log.type === 'warning' 
                            ? 'text-amber-400' 
                            : 'text-white/60'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
