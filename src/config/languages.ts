import type { Language } from '@/types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', ttsCode: 'ar' },
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', ttsCode: 'en' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', ttsCode: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', ttsCode: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', ttsCode: 'de' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', ttsCode: 'it' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', ttsCode: 'pt' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', ttsCode: 'nl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr', ttsCode: 'pl' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', ttsCode: 'ru' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', ttsCode: 'uk' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', ttsCode: 'tr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', ttsCode: 'zh' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', ttsCode: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', ttsCode: 'ko' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', ttsCode: 'hi' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', ttsCode: 'bn' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl', ttsCode: 'ur' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', direction: 'rtl', ttsCode: 'fa' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', ttsCode: 'he' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', ttsCode: 'id' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', ttsCode: 'ms' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', ttsCode: 'th' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', ttsCode: 'vi' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', direction: 'ltr', ttsCode: 'fil' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', ttsCode: 'sw' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', ttsCode: 'sv' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', ttsCode: 'no' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', ttsCode: 'da' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', ttsCode: 'fi' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', ttsCode: 'el' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', direction: 'ltr', ttsCode: 'ro' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', ttsCode: 'cs' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', ttsCode: 'hu' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', direction: 'ltr', ttsCode: 'bg' },
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
