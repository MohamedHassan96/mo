import { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '@/state/configStore';
import { Moon, Sun, Languages, ChevronDown, Check, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/config/languages';
import { getTranslations } from '@/config/i18n';

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const sortedLangs = [
    ...SUPPORTED_LANGUAGES.filter(l => POPULAR_LANG_CODES.includes(l.code)),
    ...SUPPORTED_LANGUAGES.filter(l => !POPULAR_LANG_CODES.includes(l.code)),
  ];

  const isRtl = ['ar', 'fa', 'ur'].includes(uiLanguage);

  return (
    <header className="sticky top-0 z-[9999] bg-white/80 dark:bg-bg-dark-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">

          {/* Logo */}
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors rtl:ml-1 rtl:sm:ml-2 ltr:mr-1 ltr:sm:mr-2 border border-transparent hover:border-brand-neon/50"
              >
                <svg className={`w-5 h-5 text-emerald-800/60 dark:text-white/60 ${isRtl ? 'scale-x-[-1]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-neon/10 dark:bg-brand-neon/5 flex items-center justify-center border border-brand-neon/20 shadow-sm">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-brand-neon" />
              </div>
              <div className="text-start">
                <h1 className="text-lg sm:text-xl font-extrabold text-brand-dark dark:text-white/95 tracking-tighter">
                  TalkBridge
                </h1>
                <p className="hidden sm:block text-[10px] text-brand-muted dark:text-brand-neon -mt-1 font-bold uppercase tracking-[0.2em]">
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
              className="p-2.5 sm:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-brand-neon/50"
              title={theme === 'dark' ? t.themeToggleTooltipDark : t.themeToggleTooltipLight}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-white/60 hover:text-white/95" />
              ) : (
                <Moon className="w-5 h-5 text-emerald-800/60 hover:text-brand-dark" />
              )}
            </button>

            {/* Language Selector */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-lime-50/50 dark:bg-white/5 border border-emerald-100 dark:border-white/10 hover:border-brand-neon/50 transition-all group"
                title={t.langToggleTooltip}
              >
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-brand-neon shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-emerald-900/80 dark:text-white/80 whitespace-nowrap">
                  {currentLang.nativeName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-emerald-800/40 dark:text-white/30 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute ltr:left-0 rtl:right-0 top-full mt-2 w-52 max-h-72 overflow-y-auto bg-white dark:bg-bg-dark-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-[9999] animate-fade-in">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 sticky top-0 bg-white dark:bg-bg-dark-900">
                    <p className="text-[11px] font-bold text-emerald-900/40 dark:text-white/30 uppercase tracking-widest">
                      {t.siteLangLabel}
                    </p>
                  </div>

                  {sortedLangs.map((lang, idx) => {
                    const isSelected = lang.code === uiLanguage;
                    const isFirstNonPopular = !POPULAR_LANG_CODES.includes(lang.code) &&
                      (idx === 0 || POPULAR_LANG_CODES.includes(sortedLangs[idx - 1].code));

                    return (
                      <div key={lang.code}>
                        {isFirstNonPopular && (
                          <div className="mx-3 border-t border-gray-100 dark:border-white/5 my-1" />
                        )}
                        <button
                          onClick={() => { setUiLanguage(lang.code); setDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-brand-neon/10 text-brand-muted dark:text-brand-neon'
                              : 'text-emerald-900/70 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold truncate">{lang.nativeName}</span>
                            <span className="text-[11px] text-emerald-900/30 dark:text-white/20 shrink-0">{lang.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 text-brand-neon" />}
                        </button>
                      </div>
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
