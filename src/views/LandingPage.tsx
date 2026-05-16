import { useCallback, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Languages,
  Mic,
  Globe,
  Zap,
  Video,
  MessageSquare,
  MonitorUp,
  Users,
  ArrowRight,
} from 'lucide-react';

interface LandingPageProps {
  onCreateRoom: (roomId: string) => void;
  onJoinRoom: (roomId: string) => void;
}

export default function LandingPage({ onCreateRoom, onJoinRoom }: LandingPageProps) {
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = useCallback(() => {
    const roomId = uuid().slice(0, 8).toUpperCase();
    onCreateRoom(roomId);
  }, [onCreateRoom]);

  const handleJoinRoom = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase());
    }
  }, [roomCode, onJoinRoom]);

  const features = [
    {
      icon: Video,
      title: 'مكالمات فيديو HD',
      description: 'مكالمات فيديو عالية الجودة مع الكاميرا والصوت',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Mic,
      title: 'ترجمة صوتية فورية',
      description: 'تكلم بلغتك والآخر يسمعك بلغته مباشرة',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      icon: MonitorUp,
      title: 'مشاركة الشاشة',
      description: 'شارك شاشتك أو نافذة معينة بضغطة واحدة',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: MessageSquare,
      title: 'دردشة مترجمة',
      description: 'رسائل نصية مع ترجمة تلقائية',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Globe,
      title: '13+ لغة',
      description: 'العربية المصرية، الإنجليزية، الفرنسية، وأكثر',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Zap,
      title: 'سرعة فائقة',
      description: 'ترجمة فورية بتقنية الذكاء الاصطناعي',
      color: 'from-yellow-500 to-orange-500',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] flex flex-col bg-gray-50 dark:bg-[#080808] selection:bg-[#FF4D00] selection:text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 sm:pt-20 pb-16 sm:pb-32">
        {/* Abstract Liquid Background */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FF4D00] opacity-[0.15] rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8B2B00] opacity-[0.15] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center flex flex-col items-center">
            {/* Tag */}
            <div className="animate-fade-up inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-orange-50 dark:bg-[#1a0800] border border-orange-200 dark:border-[#FF4D00]/20 mb-6 sm:mb-8">
              <span className="text-xs font-bold text-[#FF4D00] tracking-[0.2em] uppercase">
                TalkBridge
              </span>
            </div>

            {/* Heading */}
            <h1 className="animate-fade-up delay-100 text-[42px] sm:text-[72px] lg:text-[96px] font-extrabold text-gray-900 dark:text-white tracking-tighter leading-[1.02] sm:leading-[0.95] max-w-4xl mx-auto">
              اجتماعات بدون
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FF4D00] to-[#b33600]">
                حواجز اللغة
              </span>
            </h1>

            {/* Subtext */}
            <p className="animate-fade-up delay-200 mt-5 sm:mt-8 text-base sm:text-2xl text-gray-500 dark:text-[#A3A3A3] max-w-2xl mx-auto leading-relaxed font-light px-1">
              TalkBridge يجمع مكالمات الفيديو مع الترجمة الصوتية الفورية. تكلم بالعربي المصري والآخر يسمعك بالإنجليزي، في نفس اللحظة.
            </p>

            {/* Features mini */}
            <div className="animate-fade-up delay-300 mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-bold text-gray-600 dark:text-[#737373]">
              <span className="flex items-center gap-2 bg-white dark:bg-[#121212] px-3 sm:px-4 py-2 rounded-full border border-gray-200 dark:border-[#1E1E1E] shadow-sm dark:shadow-none">
                <Video className="w-4 h-4 text-[#FF4D00]" /> فيديو HD
              </span>
              <span className="flex items-center gap-2 bg-white dark:bg-[#121212] px-3 sm:px-4 py-2 rounded-full border border-gray-200 dark:border-[#1E1E1E] shadow-sm dark:shadow-none">
                <Users className="w-4 h-4 text-[#FF4D00]" /> رابط واحد للدعوة
              </span>
              <span className="flex items-center gap-2 bg-white dark:bg-[#121212] px-3 sm:px-4 py-2 rounded-full border border-gray-200 dark:border-[#1E1E1E] shadow-sm dark:shadow-none">
                <Languages className="w-4 h-4 text-[#FF4D00]" /> ترجمة فورية
              </span>
            </div>

            {/* CTA Actions */}
            <div className="animate-fade-up delay-400 mt-10 sm:mt-14 flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-2xl mx-auto">
              
              {/* Action 1: Create New Room */}
              <button
                onClick={handleCreateRoom}
                className="group flex-1 w-full md:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-4 sm:py-5 bg-[#FF4D00] text-white rounded-2xl text-base sm:text-lg font-bold 
                           shadow-[0_0_30px_rgba(255,77,0,0.3)] hover:shadow-[0_0_50px_rgba(255,77,0,0.5)]
                           transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <Video className="w-5 h-5 relative z-10" />
                <span className="relative z-10">إنشاء غرفة جديدة</span>
              </button>

              {/* Action 2: Join Existing Room */}
              <form onSubmit={handleJoinRoom} className="flex-1 w-full md:w-auto flex items-center gap-2 relative">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="أدخل كود الغرفة"
                  dir="rtl"
                  className="w-full px-5 sm:px-6 py-4 sm:py-5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 rounded-2xl text-base sm:text-lg font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00] transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A] hover:bg-[#FF4D00] text-gray-600 dark:text-gray-400 hover:text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/join"
                >
                  <ArrowRight className="w-5 h-5 -scale-x-100 group-hover/join:scale-x-100 transition-transform" />
                </button>
              </form>

            </div>

            {/* How it works */}
            <div className="animate-fade-up delay-500 mt-12 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
              {[
                { step: '1', label: 'ابدأ اجتماع', icon: Users },
                { step: '2', label: 'شارك الرابط', icon: Globe },
                { step: '3', label: 'تكلم بلغتك', icon: Mic },
                { step: '4', label: 'الآخر يفهمك', icon: Languages },
              ].map((item, i) => (
                <div key={item.step} className="flex items-center">
                  <div className="flex flex-col items-center w-full">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1E1E1E] flex items-center justify-center mb-3 sm:mb-4 group-hover:border-[#FF4D00]/50 transition-colors shadow-sm dark:shadow-none">
                      <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400 dark:text-[#A3A3A3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-[#D9D9D9] tracking-wide">{item.label}</span>
                  </div>
                  {i < 3 && <ArrowRight className="w-5 h-5 text-gray-300 dark:text-[#333333] mx-2 hidden sm:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-16 sm:pb-32">
        <div className="mb-8 sm:mb-12 text-center">
          <span className="text-[#FF4D00] font-bold tracking-[0.2em] uppercase text-xs">
            // المميزات
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-fade-up group p-5 sm:p-8 rounded-[24px] sm:rounded-[35px] bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1E1E1E]
                         hover:border-gray-300 dark:hover:border-[#333333] transition-all duration-300
                         shadow-sm hover:shadow-xl dark:shadow-none dark:hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:scale-[1.02] delay-${(i % 3 + 1) * 100}`}
            >
              <div
                className={`w-14 h-14 rounded-full bg-gray-50 dark:bg-[#1A1A1A] flex items-center justify-center mb-6 
                            group-hover:bg-[#FF4D00]/10 transition-colors duration-300`}
              >
                <feature.icon className="w-6 h-6 text-[#FF4D00]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 tracking-tight text-right">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-500 dark:text-[#737373] leading-relaxed text-right">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-[#1E1E1E] py-10 sm:py-16 bg-gray-50 dark:bg-[#080808] relative overflow-hidden">
        {/* Glow behind footer */}
        <div className="absolute bottom-[-50%] left-1/2 -translate-x-1/2 w-[80%] h-[100%] bg-[#FF4D00] opacity-[0.05] blur-[100px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center gap-5 sm:gap-6 relative z-10 text-center">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-[#FF4D00]" />
            <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tighter">TalkBridge</span>
          </div>
          <p className="text-gray-500 dark:text-[#737373] text-sm font-bold">اجتماعات فيديو بترجمة فورية بدون حواجز لغوية</p>
          
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-[#1E1E1E] to-transparent my-4" />
          
          <span className="text-xs text-gray-400 dark:text-[#333333] font-mono font-bold tracking-widest">© 2026 TALKBRIDGE. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>
    </div>
  );
}
