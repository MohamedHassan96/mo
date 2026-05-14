import { useConfigStore } from '@/state/configStore';
import { ELEVENLABS_VOICES } from '@/services/tts';
import { X, Volume2, CheckCircle, Sparkles } from 'lucide-react';
import type { TTSProvider } from '@/types';

export default function SettingsModal() {
  const { config, setConfig, showSettings, setShowSettings } = useConfigStore();

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">الإعدادات</h2>
          <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* الحالة */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-bold text-green-700 dark:text-green-300">جاهز للاستخدام! ✨</p>
              <p className="text-xs text-green-600 dark:text-green-400">كل الإعدادات مضبوطة</p>
            </div>
          </div>

          {/* مزود الصوت */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              مزود الصوت
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
                  {provider === 'elevenlabs' && '🇪🇬 مصري'}
                  {provider === 'browser' && '🔊 عادي'}
                  {provider === 'coqui' && '🖥️ محلي'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center">
              {config.ttsProvider === 'elevenlabs' && '✨ صوت عربي مصري طبيعي'}
              {config.ttsProvider === 'browser' && 'صوت المتصفح المدمج'}
              {config.ttsProvider === 'coqui' && 'خادم محلي مطلوب'}
            </p>
          </div>

          {/* معلومات ElevenLabs */}
          {config.ttsProvider === 'elevenlabs' && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-indigo-700 dark:text-indigo-300">الأصوات المتاحة</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                <span>🇪🇬 العربية: {ELEVENLABS_VOICES.ar.name}</span>
                <span>🇺🇸 الإنجليزية: {ELEVENLABS_VOICES.en.name}</span>
                <span>🇫🇷 الفرنسية: {ELEVENLABS_VOICES.fr.name}</span>
                <span>🇩🇪 الألمانية: {ELEVENLABS_VOICES.de.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
