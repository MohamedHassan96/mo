import { useEffect, useState } from 'react';
import { useConfigStore } from '@/state/configStore';
import { useRoomStore } from '@/state/roomStore';
import { useMediaDevices } from '@/app-hooks/useMediaDevices';
import { getTranslations } from '@/config/i18n';
import { ELEVENLABS_VOICES } from '@/services/tts';
import { X, Volume2, CheckCircle, Sparkles, Key, Languages, Camera, Mic, Monitor, RefreshCw } from 'lucide-react';
import type { TTSProvider } from '@/types';

export default function SettingsModal() {
  const { config, setConfig, showSettings, setShowSettings, uiLanguage } = useConfigStore();
  const { 
    selectedVideoDevice, setSelectedVideoDevice,
    selectedAudioInputDevice, setSelectedAudioInputDevice,
    cameraResolution, setCameraResolution,
    isCameraMirrored, setCameraMirrored,
    isCameraOn
  } = useRoomStore();
  const { getDevices, startCamera } = useMediaDevices();
  const t = getTranslations(uiLanguage);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const fetchDevices = async () => {
    setLoadingDevices(true);
    const devs = await getDevices();
    setDevices(devs);
    setLoadingDevices(false);
  };

  useEffect(() => {
    if (showSettings) {
      fetchDevices();
    }
  }, [showSettings]);

  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const audioInputDevices = devices.filter(d => d.kind === 'audioinput');

  const handleDeviceChange = async (type: 'video' | 'audio', deviceId: string) => {
    if (type === 'video') {
      setSelectedVideoDevice(deviceId);
      if (isCameraOn) {
        // Restart camera with new device
        setTimeout(() => startCamera(), 100);
      }
    } else {
      setSelectedAudioInputDevice(deviceId);
    }
  };

  const handleResolutionChange = (res: '360p' | '720p' | '1080p') => {
    setCameraResolution(res);
    if (isCameraOn) {
      setTimeout(() => startCamera(), 100);
    }
  };

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#064E3B]lack/60 backdrop-blur-sm" dir={['ar', 'fa', 'ur'].includes(uiLanguage) ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-[#0d1b2a] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.settingsTitle}</h2>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Media Devices Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-brand-neon uppercase tracking-widest flex items-center gap-2">
                <Camera className="w-4 h-4" />
                الأجهزة والوسائط
              </h3>
              <button 
                onClick={fetchDevices}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                disabled={loadingDevices}
              >
                <RefreshCw className={`w-4 h-4 text-brand-neon ${loadingDevices ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Camera Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-white/40 px-1">الكاميرا</label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => handleDeviceChange('video', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm focus:ring-2 focus:ring-brand-neon outline-none dark:text-white"
              >
                <option value="">Default Camera</option>
                {videoDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-white/40 px-1">الميكروفون</label>
              <select
                value={selectedAudioInputDevice}
                onChange={(e) => handleDeviceChange('audio', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm focus:ring-2 focus:ring-brand-neon outline-none dark:text-white"
              >
                <option value="">Default Microphone</option>
                {audioInputDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Mic ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution & Mirroring */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-white/40 px-1">الدقة</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                  {(['360p', '720p', '1080p'] as const).map(res => (
                    <button
                      key={res}
                      onClick={() => handleResolutionChange(res)}
                      className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                        cameraResolution === res
                          ? 'bg-brand-neon text-brand-dark'
                          : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-white/40 px-1">مرآة الفيديو</label>
                <button
                  onClick={() => setCameraMirrored(!isCameraMirrored)}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-black transition-all border ${
                    isCameraMirrored
                      ? 'bg-brand-neon/10 border-brand-neon text-brand-neon'
                      : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'
                  }`}
                >
                  {isCameraMirrored ? 'مفعل' : 'معطل'}
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-white/5" />

          {/* Gemini API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-lime-600" />
              Gemini API Key
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.geminiApiKey}
                onChange={(e) => setConfig({ geminiApiKey: e.target.value })}
                placeholder="AIza..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-lime-600 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب للترجمة والتعرف على الصوت الفائق السرعة</p>
          </div>

          {/* Groq API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Languages className="w-4 h-4 text-lime-600" />
              {t.settingsGroqKey}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.groqApiKey}
                onChange={(e) => setConfig({ groqApiKey: e.target.value })}
                placeholder="gsk_..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-lime-600 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب للترجمة بين اللغات المختلفة</p>
          </div>

          {/* ElevenLabs API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Volume2 className="w-4 h-4 text-lime-600" />
              {t.settingsElevenKey}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.elevenLabsApiKey}
                onChange={(e) => setConfig({ elevenLabsApiKey: e.target.value })}
                placeholder="Key..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-lime-600 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب لتحويل النص إلى صوت (TTS)</p>
          </div>

          {/* مزود الصوت */}

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Volume2 className="w-4 h-4 text-lime-600" />
              {t.settingsAudioProvider}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['elevenlabs', 'browser', 'coqui'] as TTSProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => setConfig({ ttsProvider: provider })}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    config.ttsProvider === provider
                      ? 'bg-lime-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {provider === 'elevenlabs' && t.settingsEgyptVoice}
                  {provider === 'browser' && t.settingsNormalVoice}
                  {provider === 'coqui' && t.settingsLocalVoice}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center">
              {config.ttsProvider === 'elevenlabs' && t.settingsEgyptDesc}
              {config.ttsProvider === 'browser' && t.settingsNormalDesc}
              {config.ttsProvider === 'coqui' && t.settingsLocalDesc}
            </p>
          </div>

          {/* معلومات ElevenLabs */}
          {config.ttsProvider === 'elevenlabs' && (
            <div className="p-4 bg-lime-50 dark:bg-lime-900/20 rounded-xl border border-lime-200 dark:border-lime-800">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-lime-600" />
                <span className="font-bold text-lime-800 dark:text-lime-300">Available Voices</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-lime-700 dark:text-lime-400">
                <span>🇪🇬 Arabic: {ELEVENLABS_VOICES.ar.name}</span>
                <span>🇺🇸 English: {ELEVENLABS_VOICES.en.name}</span>
                <span>🇫🇷 French: {ELEVENLABS_VOICES.fr.name}</span>
                <span>🇩🇪 German: {ELEVENLABS_VOICES.de.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-lime-700 hover:bg-lime-800 text-white rounded-xl font-bold">
            {t.settingsSave}
          </button>
        </div>
      </div>
    </div>
  );
}
