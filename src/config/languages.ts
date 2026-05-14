import type { Language } from '@/types';

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    ttsCode: 'ar',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    ttsCode: 'en',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    ttsCode: 'es',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    ttsCode: 'fr',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    ttsCode: 'de',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    ttsCode: 'zh',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    ttsCode: 'ja',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    ttsCode: 'ko',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    ttsCode: 'hi',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    ttsCode: 'pt',
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    ttsCode: 'ru',
  },
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    direction: 'ltr',
    ttsCode: 'tr',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    ttsCode: 'it',
  },
];

export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function getLanguageName(code: string): string {
  return getLanguageByCode(code)?.name ?? code;
}

export function getLanguageDirection(code: string): 'ltr' | 'rtl' {
  return getLanguageByCode(code)?.direction ?? 'ltr';
}

export function detectBrowserLanguage(): string {
  const lang = navigator.language.split('-')[0];
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
  return supported ? supported.code : 'en';
}
