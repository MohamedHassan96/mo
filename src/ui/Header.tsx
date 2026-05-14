import { useConfigStore } from '@/state/configStore';
import { Settings, Moon, Sun, Languages } from 'lucide-react';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function Header({ showBackButton = false, onBack }: HeaderProps) {
  const { theme, toggleTheme, setShowSettings } = useConfigStore();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl border-b border-gray-200 dark:border-[#1E1E1E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 flex-row-reverse">
          {/* Logo (Right side visually because of flex-row-reverse) */}
          <div className="flex items-center gap-3 flex-row-reverse">
            {showBackButton && (
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#121212] transition-colors ml-2 border border-transparent hover:border-[#FF4D00]/50"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-3 flex-row-reverse">
              <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-[#121212] flex items-center justify-center border border-gray-200 dark:border-[#1E1E1E] shadow-sm dark:shadow-[0_0_20px_rgba(255,77,0,0.1)]">
                <Languages className="w-5 h-5 text-[#FF4D00]" />
              </div>
              <div className="text-right">
                <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tighter">
                  TalkBridge
                </h1>
                <p className="text-[10px] text-[#FF4D00] -mt-1 font-bold uppercase tracking-[0.2em]">
                  Real-time translator
                </p>
              </div>
            </div>
          </div>

          {/* Controls (Left side visually) */}
          <div className="flex items-center gap-2 flex-row-reverse">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-[#121212] transition-colors border border-transparent hover:border-[#FF4D00]/50"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white" />
              ) : (
                <Moon className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white" />
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-[#121212] transition-colors border border-transparent hover:border-[#FF4D00]/50"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-500 dark:text-[#A3A3A3] hover:text-gray-900 dark:hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
