import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function LanguageSelector({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
}: LanguageSelectorProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</label>
      )}
      <div className="relative">
        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full pl-11 pr-5 py-3 rounded-[20px] border border-gray-200 dark:border-[#1E1E1E] 
                     bg-gray-50 dark:bg-[#080808] text-gray-950 dark:text-white
                     focus:outline-none focus:ring-1 focus:ring-[#FF4D00] focus:border-[#FF4D00]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     appearance-none cursor-pointer text-sm font-bold
                     transition-colors"
          dir="rtl"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-white dark:bg-[#121212] text-gray-950 dark:text-white font-bold py-2">
              {lang.nativeName} — {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-[#A3A3A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
