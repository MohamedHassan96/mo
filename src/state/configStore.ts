import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppConfig, Theme, TTSProvider } from '@/types';

interface ConfigState {
  config: AppConfig;
  theme: Theme;
  showSettings: boolean;
  setConfig: (config: Partial<AppConfig>) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setShowSettings: (show: boolean) => void;
  isConfigured: () => boolean;
}

// الإعدادات الافتراضية - كل المفاتيح جاهزة
const DEFAULT_CONFIG: AppConfig = {
  groqApiKey: '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',
  ttsProvider: 'elevenlabs' as TTSProvider,
  elevenLabsApiKey: 'sk_843dd615cc8adc26fe700c0cb742e6067c6c94d256da1126',
  elevenLabsVoiceId: '',
  xttsUrl: 'http://localhost:8080',
  xttsApiToken: '',
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      theme: 'dark',
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

      setShowSettings: (show) => set({ showSettings: show }),

      // دائماً جاهز
      isConfigured: () => true,
    }),
    {
      name: 'talkbridge-config',
      partialize: (state) => ({
        config: state.config,
        theme: state.theme,
      }),
    }
  )
);
