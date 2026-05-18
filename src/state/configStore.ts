import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppConfig, Theme, TTSProvider } from '@/types';
import { detectBrowserLanguage } from '@/config/languages';

interface ConfigState {
  config: AppConfig;
  theme: Theme;
  uiLanguage: string;       // لغة واجهة المستخدم (اللغة الديفولت للموقع)
  showSettings: boolean;
  setConfig: (config: Partial<AppConfig>) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setUiLanguage: (lang: string) => void;
  setShowSettings: (show: boolean) => void;
  isConfigured: () => boolean;
}

// الإعدادات الافتراضية - كل المفاتيح جاهزة
const DEFAULT_CONFIG: AppConfig = {
  groqApiKey: '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',
  geminiApiKey: 'AIzaSyDXCXhA8x1LoGIN3WeXjb1QjSQ8MMISvxo',
  ttsProvider: 'elevenlabs' as TTSProvider,
  elevenLabsApiKey: 'sk_7d7d8cef5364e849e17c86cb949a416bf54eefad07437056',
  elevenLabsVoiceId: 'c06fdbaa06e04b6cbe80fb460336f064',
  xttsUrl: 'http://localhost:8080',
  xttsApiToken: '',
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      theme: 'dark',
      uiLanguage: detectBrowserLanguage(),  // يكتشف لغة المتصفح تلقائياً
      showSettings: false,

      setConfig: (partial) =>
        set((state) => ({
          config: { ...state.config, ...partial },
        })),

      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      },

      setUiLanguage: (lang) => set({ uiLanguage: lang }),

      setShowSettings: (show) => set({ showSettings: show }),

      // دائماً جاهز
      isConfigured: () => true,
    }),
    {
      name: 'talkbridge-config',
      partialize: (state) => ({
        config: state.config,
        theme: state.theme,
        uiLanguage: state.uiLanguage,
      }),
    }
  )
);
