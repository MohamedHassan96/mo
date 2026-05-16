import { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '@/state/configStore';
import { Moon, Sun, Languages, ChevronDown, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/config/languages';
import { getTranslations } from '@/config/i18n';

// أبرز اللغات الأكثر استخداماً في الأعلى
const POPULAR_LANG_CODES = ['ar', 'en', 'fr', 'de', 'es', 'tr', 'zh', 'ru', 'pt', 'hi'];

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function Header({ showBackButton = false, onBack }: HeaderProps) {
  const { theme, toggleTheme, uiLanguage, setUiLanguage } = useConfigStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const t = getTranslations(uiLanguage);
  const currentLang = getLanguageByCode(uiLanguage) ?? SUPPORTED_LANGUAGES[0];

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // اللغات المشهورة أولاً ثم الباقي
  const sortedLangs = [
    ...SUPPORTED_LANGUAGES.filter(l => POPULAR_LANG_CODES.includes(l.code)),
    ...SUPPORTED_LANGUAGES.filter(l => !POPULAR_LANG_CODES.includes(l.code)),
  ];

  const isRtl = ['ar', 'fa', 'ur'].includes(uiLanguage);

  return (
    <header className="sticky top-0 z-[9999] bg-white/85 dark:bg-[#022C22]/85 backdrop-blur-xl border-b border-gray-200 dark:border-[#1E1E1E]" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">

          {/* Logo */}
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#121212] transition-colors rtl:ml-1 rtl:sm:ml-2 ltr:mr-1 ltr:sm:mr-2 border border-transparent hover:border-[#A3E635]/50"
              >
                <svg className={`w-5 h-5 text-gray-500 dark:text-[#A3A3A3] ${isRtl ? 'scale-x-[-1]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-50 dark:bg-[#065F46] flex items-center justify-center border border-gray-200 dark:border-[#1E1E1E] shadow-sm dark:shadow-[0_0_20px_rgba(163,230,53,0.1)]">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-[#65A30D]" />
              </div>
              <div className="text-start">
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tighter">
                  TalkBridge
                </h1>
                <p className="hidden sm:block text-[10px] text-[#65A30D] -mt-1 font-bold uppercase tracking-[0.2em]">
                  Real-time translator
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 sm:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-[#121212] transition-colors border border-transparent hover:border-[#A3E635]/50"
              title={theme === 'dark' ? t.themeToggleTooltipDark : t.themeToggleTooltipLight}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white" />
              ) : (
                <Moon className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white" />
              )}
            </button>

            {/* Language Selector */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-lime-50 dark:bg-[#065F46] border border-emerald-100 dark:border-[#1E1E1E] hover:border-[#A3E635]/50 transition-all group"
                title={t.langToggleTooltip}
                aria-label={t.langToggleTooltip}
              >
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-[#65A30D] shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {currentLang.nativeName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute ltr:left-0 rtl:right-0 top-full mt-2 w-52 max-h-72 overflow-y-auto bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222] rounded-2xl shadow-2xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-[9999] animate-fade-in">
                  {/* Header of dropdown */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1E1E1E] sticky top-0 bg-white dark:bg-[#111111]">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      {t.siteLangLabel}
                    </p>
                  </div>

                  {sortedLangs.map((lang, idx) => {
                    const isSelected = lang.code === uiLanguage;
                    const isFirstNonPopular = !POPULAR_LANG_CODES.includes(lang.code) &&
                      (idx === 0 || POPULAR_LANG_CODES.includes(sortedLangs[idx - 1].code));

                    return (
                      <>
                        {isFirstNonPopular && (
                          <div key={`divider-${lang.code}`} className="mx-3 border-t border-gray-100 dark:border-[#222222] my-1" />
                        )}
                        <button
                          key={lang.code}
                          onClick={() => { setUiLanguage(lang.code); setDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-[#A3E635]/10 text-[#65A30D]'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1A1A1A]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold truncate">{lang.nativeName}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{lang.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 text-[#65A30D]" />}
                        </button>
                      </>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}
