import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAssemblyAIOptions {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useAssemblyAI(options: UseAssemblyAIOptions) {
  const { language, onResult, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(true); // Always true as we use modern Web APIs

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const stopListening = useCallback(() => {
    setIsListening(false);

    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ terminate_session: true }));
      socketRef.current.close();
      socketRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    console.log('[AssemblyAI] Stopped');
  }, []);

  const startListening = useCallback(async () => {
    try {
      // 1. Get Token from our server
      const tokenRes = await fetch('/api/assemblyai-token');
      const tokenData = await tokenRes.json();
      if (!tokenData.ok) throw new Error(tokenData.error);
      const token = tokenData.token;

      // 2. Setup WebSocket
      // Note: sample_rate=16000 is recommended for better performance
      const langMap: Record<string, string> = {
        'en': 'en_us', 'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it',
        'pt': 'pt', 'hi': 'hi', 'ja': 'ja', 'zh': 'zh', 'tr': 'tr'
      };
      const langCode = langMap[language] || 'en_us';

      const socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}&language_code=${langCode}`);
      socketRef.current = socket;

      socket.onopen = async () => {
        console.log('[AssemblyAI] WebSocket Open');

        // 3. Start Audio Capture
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert to 16-bit PCM
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            // Send as Base64
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
            socket.send(JSON.stringify({ audio_data: base64Audio }));
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        setIsListening(true);
      };

      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.message_type === 'PartialTranscript') {
          if (data.text) onResultRef.current(data.text, false);
        } else if (data.message_type === 'FinalTranscript') {
          if (data.text) onResultRef.current(data.text, true);
        } else if (data.message_type === 'SessionBegun') {
          console.log('[AssemblyAI] Session Begun:', data.session_id);
        } else if (data.error) {
          console.error('[AssemblyAI] Socket Error Message:', data.error);
          onError?.(data.error);
        }
      };

      socket.onerror = (e) => {
        console.error('[AssemblyAI] WebSocket Error:', e);
        onError?.('WebSocket Connection Error');
      };

      socket.onclose = () => {
        console.log('[AssemblyAI] WebSocket Closed');
        setIsListening(false);
      };

    } catch (err: any) {
      console.error('[AssemblyAI] Start Error:', err);
      onError?.(err.message || 'Failed to start AssemblyAI');
      stopListening();
    }
  }, [onError, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isListening, isSupported, startListening, stopListening };
}
