import { useConfigStore } from '@/state/configStore';
import { getTranslations } from '@/config/i18n';
import { ELEVENLABS_VOICES } from '@/services/tts';
import { X, Volume2, CheckCircle, Sparkles, Key, Languages } from 'lucide-react';
import type { TTSProvider } from '@/types';

export default function SettingsModal() {
  const { config, setConfig, showSettings, setShowSettings, uiLanguage } = useConfigStore();
  const t = getTranslations(uiLanguage);

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir={['ar', 'fa', 'ur'].includes(uiLanguage) ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.settingsTitle}</h2>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* الحالة */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-bold text-green-700 dark:text-green-300">{t.settingsReady}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{t.settingsReadyDesc}</p>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Gemini API Key
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.geminiApiKey}
                onChange={(e) => setConfig({ geminiApiKey: e.target.value })}
                placeholder="AIza..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب للترجمة والتعرف على الصوت الفائق السرعة</p>
          </div>

          {/* Groq API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Languages className="w-4 h-4 text-indigo-500" />
              {t.settingsGroqKey}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.groqApiKey}
                onChange={(e) => setConfig({ groqApiKey: e.target.value })}
                placeholder="gsk_..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب للترجمة بين اللغات المختلفة</p>
          </div>

          {/* ElevenLabs API Key */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              {t.settingsElevenKey}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={config.elevenLabsApiKey}
                onChange={(e) => setConfig({ elevenLabsApiKey: e.target.value })}
                placeholder="Key..."
                className="w-full pl-11 pr-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500">مطلوب لتحويل النص إلى صوت (TTS)</p>
          </div>

          {/* مزود الصوت */}

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              {t.settingsAudioProvider}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['elevenlabs', 'browser', 'coqui'] as TTSProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => setConfig({ ttsProvider: provider })}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    config.ttsProvider === provider
                      ? 'bg-indigo-500 text-white shadow-lg'
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
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-indigo-700 dark:text-indigo-300">Available Voices</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-indigo-600 dark:text-indigo-400">
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
            {t.settingsSave}
          </button>
        </div>
      </div>
    </div>
  );
}
