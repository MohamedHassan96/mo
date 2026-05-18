export type UITranslations = {
  // Landing
  tagline: string;
  heroTitle: string;
  heroHighlight: string;
  heroDesc: string;
  badgeHD: string;
  badgeLink: string;
  badgeTranslate: string;
  createRoom: string;
  joinPlaceholder: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  featuresLabel: string;
  footerDesc: string;
  feat1Title: string; feat1Desc: string;
  feat2Title: string; feat2Desc: string;
  feat3Title: string; feat3Desc: string;
  feat4Title: string; feat4Desc: string;
  feat5Title: string; feat5Desc: string;
  feat6Title: string; feat6Desc: string;

  // Room Setup
  roomSetupTitle: string;
  roomJoinTitle: string;
  roomSetupDesc: string;
  roomCodeLabel: string;
  nameLabel: string;
  hostNamePlaceholder: string;
  guestNamePlaceholder: string;
  myLanguageLabel: string;
  partnerLanguageLabel: string;
  startButtonHost: string;
  startButtonGuest: string;

  // Connecting
  waitingForGuest: string;
  connectingSecurely: string;
  establishingP2P: string;
  shareLinkPrompt: string;
  copyLink: string;
  linkCopied: string;

  // Active Room
  onlineCount: string;
  inviteBtn: string;
  listeningStatus: string;
  errorStatus: string;
  synthesizingStatus: (name: string) => string;

  // Invite Modal
  inviteModalTitle: string;
  inviteModalActive: string;
  copyRoomLinkBtn: string;
  copyRoomCodeBtn: string;
  shareBtn: string;

  // Settings Modal
  settingsTitle: string;
  settingsReady: string;
  settingsReadyDesc: string;
  settingsAudioProvider: string;
  settingsEgyptVoice: string;
  settingsNormalVoice: string;
  settingsLocalVoice: string;
  settingsEgyptDesc: string;
  settingsNormalDesc: string;
  settingsLocalDesc: string;
  settingsVoiceId: string;
  settingsSave: string;
  settingsGroqKey: string;
  settingsElevenKey: string;

  // VideoGrid
  videoGridYou: string;
  videoGridScreenShare: string;
  videoGridExpand: string;
  videoGridWaiting: string;
  videoGridSharePrompt: string;

  // Panels
  tabChat: string;
  tabTranscript: string;
  tabParticipants: string;
  chatTitle: string;
  chatAutoTranslate: string;
  chatEmpty: string;
  chatStart: string;
  chatTranslationLabel: string;
  chatTranslating: string;
  chatInputPlaceholder: string;
  transcriptTitle: string;
  transcriptExportTooltip: string;
  transcriptExportBtn: string;
  transcriptEmpty: string;
  transcriptStart: string;
  participantsTitle: string;
  participantsEmpty: string;
  participantYou: string;
  participantHost: string;
  participantGuest: string;
  participantUnknown: string;
  statusScreenShare: string;
  statusCamOn: string;
  statusCamOff: string;
  statusMicOn: string;
  statusMicOff: string;

  // Header / Common
  themeToggleTooltipDark: string;
  themeToggleTooltipLight: string;
  langToggleTooltip: string;
  siteLangLabel: string;
};

const HindiTranslationLabel = 'अनुवाद:';
const HindiParticipantsTitle = 'प्रतिभागी';
const HindiParticipantGuest = 'अतिथि';

const translations: Record<string, Partial<UITranslations>> = {
  en: {
    tagline: 'TalkBridge',
    heroTitle: 'Meetings Without',
    heroHighlight: 'Language Barriers',
    heroDesc: 'TalkBridge combines video calls with real-time voice translation. Speak your language while the other hears you in theirs — instantly.',
    badgeHD: 'HD Video', badgeLink: 'Single Invite Link', badgeTranslate: 'Real-time Translation',
    createRoom: 'Create New Room', joinPlaceholder: 'Enter room code',
    step1: 'Start Meeting', step2: 'Share Link', step3: 'Speak Your Language', step4: 'They Understand',
    featuresLabel: '// Features', footerDesc: 'Video meetings with real-time translation, no language barriers.',
    feat1Title: 'HD Video Calls', feat1Desc: 'High-quality video calls with camera and audio',
    feat2Title: 'Real-time Voice Translation', feat2Desc: 'Speak your language, others hear theirs instantly',
    feat3Title: 'Screen Sharing', feat3Desc: 'Share your screen or a specific window in one click',
    feat4Title: 'Translated Chat', feat4Desc: 'Text messages with automatic translation',
    feat5Title: '13+ Languages', feat5Desc: 'Arabic, English, French, and more',
    feat6Title: 'Lightning Fast', feat6Desc: 'Instant translation powered by AI',
    roomSetupTitle: 'Setup Room', roomJoinTitle: 'Join Room', roomSetupDesc: 'Get ready for an instant translated conversation',
    roomCodeLabel: 'Room Code', nameLabel: 'Nickname', hostNamePlaceholder: 'Host', guestNamePlaceholder: 'Your Name',
    myLanguageLabel: 'Your Language', partnerLanguageLabel: 'Partner\'s Language',
    startButtonHost: 'Create Room & Connect', startButtonGuest: 'Join Room Now',
    waitingForGuest: 'Waiting for guest...', connectingSecurely: 'Connecting securely...',
    establishingP2P: 'Establishing encrypted P2P tunnel and linking translated audio',
    shareLinkPrompt: 'Share this link with your guest:', copyLink: 'Copy Link', linkCopied: '✓ Copied Successfully',
    onlineCount: 'Online', inviteBtn: 'Invite', listeningStatus: 'Listening...', errorStatus: 'Error',
    synthesizingStatus: (name) => `🔊 ${name} is speaking...`,
    inviteModalTitle: 'Invite to join', inviteModalActive: 'currently online',
    copyRoomLinkBtn: 'Copy Link', copyRoomCodeBtn: 'Copy Room Code', shareBtn: 'Share',
    // Settings Modal
    settingsTitle: 'Settings',
    settingsReady: 'Ready to use! ✨',
    settingsReadyDesc: 'All settings are configured',
    settingsAudioProvider: 'Audio Provider',
    settingsEgyptVoice: '🇪🇬 Egyptian',
    settingsNormalVoice: '🔊 Normal',
    settingsLocalVoice: '🖥️ Local',
    settingsEgyptDesc: '✨ Natural Egyptian Arabic voice',
    settingsNormalDesc: 'Built-in browser voice',
    settingsLocalDesc: 'Local server required',
    settingsVoiceId: 'Voice ID',
    settingsSave: 'Save Settings',
    settingsGroqKey: 'Groq API Key',
    settingsElevenKey: 'ElevenLabs API Key',

    // VideoGrid
    videoGridYou: '(You)',
    videoGridScreenShare: 'Screen Share',
    videoGridExpand: 'Expand Screen',
    videoGridWaiting: 'Waiting for others to join...',
    videoGridSharePrompt: 'Share the invite link to start',

    // Panels
    tabChat: 'Chat',
    tabTranscript: 'Transcript',
    tabParticipants: 'Participants',
    chatTitle: 'Chat',
    chatAutoTranslate: 'Auto Translate',
    chatEmpty: 'No messages yet',
    chatStart: 'Start the conversation!',
    chatTranslationLabel: 'Translation:',
    chatTranslating: 'Translating...',
    chatInputPlaceholder: 'Type a message...',
    transcriptTitle: 'Voice Transcript',
    transcriptExportTooltip: 'Export Transcript',
    transcriptExportBtn: 'Export',
    transcriptEmpty: 'No transcript yet',
    transcriptStart: 'Start speaking to see the transcript here',
    participantsTitle: 'Participants',
    participantsEmpty: 'No participants yet',
    participantYou: 'You',
    participantHost: 'Host',
    participantGuest: 'Guest',
    participantUnknown: 'Unknown',
    statusScreenShare: 'Sharing screen',
    statusCamOn: 'Camera on',
    statusCamOff: 'Camera off',
    statusMicOn: 'Microphone on',
    statusMicOff: 'Microphone off',

    themeToggleTooltipDark: 'Switch to light mode', themeToggleTooltipLight: 'Switch to dark mode',
    langToggleTooltip: 'Change site language', siteLangLabel: 'Site Language',
  },
  ar: {
    tagline: 'TalkBridge',
    heroTitle: 'اجتماعات بدون',
    heroHighlight: 'حواجز اللغة',
    heroDesc: 'TalkBridge يجمع مكالمات الفيديو مع الترجمة الصوتية الفورية. تكلم بلغتك والآخر يسمعك بلغته، في نفس اللحظة.',
    badgeHD: 'فيديو HD', badgeLink: 'رابط واحد للدعوة', badgeTranslate: 'ترجمة فورية',
    createRoom: 'إنشاء غرفة جديدة', joinPlaceholder: 'أدخل كود الغرفة',
    step1: 'ابدأ اجتماع', step2: 'شارك الرابط', step3: 'تكلم بلغتك', step4: 'الآخر يفهمك',
    featuresLabel: '// المميزات', footerDesc: 'اجتماعات فيديو بترجمة فورية بدون حواجز لغوية.',
    feat1Title: 'مكالمات فيديو HD', feat1Desc: 'مكالمات فيديو عالية الجودة مع الكاميرا والصوت',
    feat2Title: 'ترجمة صوتية فورية', feat2Desc: 'تكلم بلغتك والآخر يسمعك بلغته مباشرة',
    feat3Title: 'مشاركة الشاشة', feat3Desc: 'شارك شاشتك أو نافذة معينة بضغطة واحدة',
    feat4Title: 'دردشة مترجمة', feat4Desc: 'رسائل نصية مع ترجمة تلقائية',
    feat5Title: '13+ لغة', feat5Desc: 'العربية، الإنجليزية، الفرنسية، وأكثر',
    feat6Title: 'سرعة فائقة', feat6Desc: 'ترجمة فورية بتقنية الذكاء الاصطناعي',
    roomSetupTitle: 'تجهيز الغرفة', roomJoinTitle: 'الانضمام للغرفة', roomSetupDesc: 'استعد لبدء محادثة فورية ومترجمة',
    roomCodeLabel: 'كود الغرفة', nameLabel: 'الاسم المستعار', hostNamePlaceholder: 'المضيف', guestNamePlaceholder: 'اسمك',
    myLanguageLabel: 'لغتك', partnerLanguageLabel: 'لغة الطرف الآخر',
    startButtonHost: 'إنشاء الغرفة وبدء الاتصال', startButtonGuest: 'دخول الغرفة الآن',
    waitingForGuest: 'في انتظار الضيف...', connectingSecurely: 'جاري الاتصال الآمن...',
    establishingP2P: 'يتم إنشاء نفق اتصال P2P مشفر وربط الصوت المترجم',
    shareLinkPrompt: 'شارك هذا الرابط للضيف:', copyLink: 'نسخ الرابط', linkCopied: '✓ تم النسخ بنجاح',
    onlineCount: 'متصل', inviteBtn: 'دعوة', listeningStatus: 'جاري الاستماع...', errorStatus: 'خطأ',
    synthesizingStatus: (name) => `🔊 ${name} يتحدث...`,
    inviteModalTitle: 'دعوة للمشاركة', inviteModalActive: 'متصلون حالياً',
    copyRoomLinkBtn: 'نسخ الرابط', copyRoomCodeBtn: 'نسخ كود الغرفة', shareBtn: 'مشاركة',

    settingsTitle: 'الإعدادات', settingsReady: 'جاهز للاستخدام! ✨', settingsReadyDesc: 'كل الإعدادات مضبوطة',
    settingsAudioProvider: 'مزود الصوت', settingsEgyptVoice: '🇪🇬 مصري', settingsNormalVoice: '🔊 عادي', settingsLocalVoice: '🖥️ محلي',
    settingsEgyptDesc: '✨ صوت عربي مصري طبيعي', settingsNormalDesc: 'صوت المتصفح المدمج', settingsLocalDesc: 'خادم محلي مطلوب',
    settingsVoiceId: 'معرف الصوت', settingsSave: 'حفظ الإعدادات',
    settingsGroqKey: 'مفتاح Groq API',
    settingsElevenKey: 'مفتاح ElevenLabs API',
    tabChat: 'الدردشة', tabTranscript: 'النص', tabParticipants: 'المشاركون',
    chatTitle: 'الدردشة', chatAutoTranslate: 'ترجمة تلقائية', chatEmpty: 'لا توجد رسائل بعد', chatStart: 'ابدأ المحادثة!',
    chatTranslationLabel: 'الترجمة:', chatTranslating: 'جاري الترجمة...', chatInputPlaceholder: 'اكتب رسالة...',
    transcriptTitle: 'نص الترجمة الصوتية', transcriptExportTooltip: 'تصدير النص', transcriptExportBtn: 'تصدير',
    transcriptEmpty: 'لا يوجد نص بعد', transcriptStart: 'ابدأ الكلام لتظهر الترجمة هنا',
    participantsTitle: 'المشاركون', participantsEmpty: 'لا يوجد مشاركون بعد', participantYou: 'أنت', participantHost: 'مضيف', participantGuest: 'ضيف', participantUnknown: 'مجهول',
    statusScreenShare: 'يشارك الشاشة', statusCamOn: 'الكاميرا شغالة', statusCamOff: 'الكاميرا مغلقة', statusMicOn: 'الميكروفون شغال', statusMicOff: 'الميكروفون مكتوم',

    themeToggleTooltipDark: 'التبديل للوضع المضيء', themeToggleTooltipLight: 'التبديل للوضع المظلم',
    langToggleTooltip: 'تغيير لغة الموقع', siteLangLabel: 'لغة الموقع',
  },
  fa: {
    tagline: 'TalkBridge',
    heroTitle: 'جلسات بدون',
    heroHighlight: 'موانع زبانی',
    heroDesc: 'TalkBridge تماس‌های ویدیویی را با ترجمه صوتی در زمان واقعی ترکیب می‌کند. به زبان خود صحبت کنید در حالی که دیگران شما را به زبان خود می‌شنوند - فوراً.',
    badgeHD: 'ویدیوی HD', badgeLink: 'فقط یک لینک دعوت', badgeTranslate: 'ترجمه همزمان',
    createRoom: 'ایجاد اتاق جدید', joinPlaceholder: 'کد اتاق را وارد کنید',
    step1: 'شروع جلسه', step2: 'اشتراک گذاری لینک', step3: 'به زبان خود صحبت کنید', step4: 'آنها می‌فهمند',
    featuresLabel: '// ویژگی‌ها', footerDesc: 'جلسات ویدیویی با ترجمه همزمان، بدون موانع زبانی.',
    feat1Title: 'تماس‌های ویدیویی HD', feat1Desc: 'تماس‌های ویدیویی با کیفیت بالا',
    feat2Title: 'ترجمه صوتی همزمان', feat2Desc: 'شما به زبان خود صحبت می‌کنید، دیگران به زبان خودشان می‌شنوند',
    feat3Title: 'اشتراک گذاری صفحه', feat3Desc: 'صفحة خود را با یک کلیک به اشتراک بگذارید',
    feat4Title: 'چت ترجمه شده', feat4Desc: 'پیام‌های متنی با ترجمه خودکار',
    feat5Title: 'بیش از ۱۳ زبان', feat5Desc: 'فارسی، عربی، انگلیسی و بیشتر',
    feat6Title: 'سرعت رعد و برق', feat6Desc: 'ترجمه فوری با هوش مصنوعی',
    roomSetupTitle: 'تنظیمات اتاق', roomJoinTitle: 'پیوستن به اتاق', roomSetupDesc: 'برای یک گفتگوی فوری و ترجمه شده آماده شوید',
    roomCodeLabel: 'کد اتاق', nameLabel: 'نام مستعار', hostNamePlaceholder: 'میزبان', guestNamePlaceholder: 'نام شما',
    myLanguageLabel: 'زبان شما', partnerLanguageLabel: 'زبان طرف مقابل',
    startButtonHost: 'ایجاد اتاق و اتصال', startButtonGuest: 'اکنون وارد اتاق شوید',
    waitingForGuest: 'در انتظار مهمان...', connectingSecurely: 'در حال اتصال امن...',
    establishingP2P: 'ایجاد تونل رمزگذاری شده P2P و پیوند صدای ترجمه شده',
    shareLinkPrompt: 'این لینک را با مهمان خود به اشتراک بگذارید:', copyLink: 'کپی لینک', linkCopied: '✓ با موفقیت کپی شد',
    onlineCount: 'آنلاین', inviteBtn: 'دعوت', listeningStatus: 'در حال گوش دادن...', errorStatus: 'خطا',
    synthesizingStatus: (name) => `🔊 ${name} در حال صحبت است...`,
    inviteModalTitle: 'دعوت به پیوستن', inviteModalActive: 'در حال حاضر آنلاین',
    copyRoomLinkBtn: 'کپی لینک', shareBtn: 'اشتراک‌گذاری',
    themeToggleTooltipDark: 'حالت روشن', themeToggleTooltipLight: 'حالت تاریک',
    langToggleTooltip: 'تغییر زبان سایت', siteLangLabel: 'زبان سایت',

    settingsTitle: 'تنظیمات', settingsReady: 'آماده استفاده! ✨', settingsReadyDesc: 'همه تنظیمات پیکربندی شده است',
    settingsAudioProvider: 'ارائه‌دهنده صدا', settingsEgyptVoice: '🇪🇬 مصری', settingsNormalVoice: '🔊 عادی', settingsLocalVoice: '🖥️ محلی',
    settingsEgyptDesc: '✨ صدای طبیعی عربی مصری', settingsNormalDesc: 'صدای مرورگر', settingsLocalDesc: 'نیاز به سرور محلی',
    settingsVoiceId: 'شناسه صدا', settingsSave: 'ذخیره تنظیمات',
    videoGridYou: '(شما)', videoGridScreenShare: 'اشتراک گذاری صفحه', videoGridExpand: 'بزرگ کردن صفحه',
    videoGridWaiting: 'در انتظار پیوستن دیگران...', videoGridSharePrompt: 'لینک دعوت را برای شروع به اشتراک بگذارید',
    tabChat: 'چت', tabTranscript: 'متن', tabParticipants: 'شرکت کنندگان',
    chatTitle: 'چت', chatAutoTranslate: 'ترجمه خودکار', chatEmpty: 'هنوز پیامی نیست', chatStart: 'مکالمه را شروع کنید!',
    chatTranslationLabel: 'ترجمه:', chatTranslating: 'در حال ترجمه...', chatInputPlaceholder: 'پیام خود را بنویسید...',
    transcriptTitle: 'متن صوتی', transcriptExportTooltip: 'خروجی گرفتن', transcriptExportBtn: 'خروجی',
    transcriptEmpty: 'هنوز متنی نیست', transcriptStart: 'صحبت کنید تا متن اینجا ظاهر شود',
    participantsTitle: 'شرکت کنندگان', participantsEmpty: 'هنوز کسی نیست', participantYou: 'شما', participantHost: 'میزبان', participantGuest: 'مهمان', participantUnknown: 'ناشناس',
    statusScreenShare: 'در حال اشتراک صفحه', statusCamOn: 'دوربین روشن', statusCamOff: 'دوربین خاموش', statusMicOn: 'میکروفون روشن', statusMicOff: 'میکروفون خاموش',
  },
  ur: {
    tagline: 'TalkBridge',
    heroTitle: 'زبان کی رکاوٹوں کے',
    heroHighlight: 'بغیر میٹنگز',
    heroDesc: 'TalkBridge ویڈیو کالز کو ریئل ٹائم صوتی ترجمے کے ساتھ جوڑتا ہے۔ اپنی زبان میں بات کریں، دوسرا فوراً اپنی زبان میں سنے گا۔',
    badgeHD: 'HD ویڈیو', badgeLink: 'صرف ایک دعوتی لنک', badgeTranslate: 'فوری ترجمہ',
    createRoom: 'نیا کمرہ بنائیں', joinPlaceholder: 'کمرے کا کوڈ درج کریں',
    step1: 'میٹنگ شروع کریں', step2: 'لنک شیئر کریں', step3: 'अपनी زبان بولیں', step4: 'وہ سمجھتے ہیں',
    featuresLabel: '// خصوصیات', footerDesc: 'زبان کی رکاوٹوں کے بغیر ریئل ٹائم ترجمہ کے ساتھ ویڈیو میٹنگز۔',
    feat1Title: 'HD ویڈیو کالز', feat1Desc: 'کیمرے اور آڈیو کے साथ اعلیٰ معیار کی ویڈیو کالز',
    feat2Title: 'فوری صوتی ترجمہ', feat2Desc: 'آپ اپنی زبان میں بات کریں، دوسرے اپنی میں سنیں',
    feat3Title: 'اسکرین شیئرنگ', feat3Desc: 'अपनी اسکرین کو ایک کلک سے شیئر کریں',
    feat4Title: 'ترجمہ شدہ چیٹ', feat4Desc: 'خودکار ترجمے کے साथ ٹیکسٹ پیغامات',
    feat5Title: '13+ زبانیں', feat5Desc: 'اردو، عربی، انگریزی، اور مزید',
    feat6Title: 'تیز رفتار', feat6Desc: 'AI کی طاقت سے فوری ترجمہ',
    roomSetupTitle: 'کمرے کی ترتیب', roomJoinTitle: 'کمرے میں شامل ہوں', roomSetupDesc: 'فوری ترجمہ شدہ گفتگو کے لیے تیار ہو جائیں',
    roomCodeLabel: 'کمرے کا کوڈ', nameLabel: 'عرفی نام', hostNamePlaceholder: 'میزبان', guestNamePlaceholder: 'آپ کا نام',
    myLanguageLabel: 'آپ کی زبان', partnerLanguageLabel: 'دوسرے کی زبان',
    startButtonHost: 'کمرہ بنائیں اور جڑیں', startButtonGuest: 'ابھی شامل ہوں',
    waitingForGuest: 'مہمان کا انتظار ہے...', connectingSecurely: 'محفوظ طریقے سے جڑ رہا ہے...',
    establishingP2P: 'خفیہ کاری شدہ P2P ٹنل قائم کیا جا رہا ہے',
    shareLinkPrompt: 'یہ لنک اپنے مہمان کے साथ شیئر کریں:', copyLink: 'لنک کاپی کریں', linkCopied: '✓ کامیابی سے کاپی ہو گیا',
    onlineCount: 'آن لائن', inviteBtn: 'دعوت دیں', listeningStatus: 'سن رہا ہے...', errorStatus: 'غلطی',
    synthesizingStatus: (name) => `🔊 ${name} بول رہے ہیں...`,
    inviteModalTitle: 'شامل ہونے کی دعوت', inviteModalActive: 'اس وقت آن لائن',
    copyRoomLinkBtn: 'لنک کاپی کریں', shareBtn: 'شیئر کریں',
    themeToggleTooltipDark: 'لائٹ موڈ', themeToggleTooltipLight: 'ڈارک موڈ',
    langToggleTooltip: 'سائٹ کی زبان تبدیل کریں', siteLangLabel: 'سائٹ کی زبان',

    settingsTitle: 'ترتیبات', settingsReady: 'استعمال کے لئے تیار! ✨', settingsReadyDesc: 'تمام ترتیبات محفوظ ہیں',
    settingsAudioProvider: 'آڈیو فراہم کنندہ', settingsEgyptVoice: '🇪🇬 مصری', settingsNormalVoice: '🔊 عام', settingsLocalVoice: '🖥️ مقامی',
    settingsEgyptDesc: '✨ قدرتی مصری عربی آواز', settingsNormalDesc: 'براؤزر کی آواز', settingsLocalDesc: 'مقامی سرور درکار ہے',
    settingsVoiceId: 'آواز کی شناخت', settingsSave: 'ترتیبات محفوظ کریں',
    videoGridYou: '(آپ)', videoGridScreenShare: 'اسکرین شیئر', videoGridExpand: 'اسکرین بڑی کریں',
    videoGridWaiting: 'دوسروں کے شامل ہونے کا انتظار کر رہے ہیں...', videoGridSharePrompt: 'شروع کرنے کے لیے دعوتی لنک شیئر کریں',
    tabChat: 'چیٹ', tabTranscript: 'ٹرانسکرپٹ', tabParticipants: 'شرکاء',
    chatTitle: 'چیٹ', chatAutoTranslate: 'خودکار ترجمہ', chatEmpty: 'ابھی کوئی پیغام نہیں', chatStart: 'بات چیت شروع کریں!',
    chatTranslationLabel: 'ترجمہ:', chatTranslating: 'ترجمہ ہو رہا ہے...', chatInputPlaceholder: 'پیغام لکھیں...',
    transcriptTitle: 'صوتی ٹرانسکرپٹ', transcriptExportTooltip: 'ٹرانسکرپٹ ایکسپورٹ کریں', transcriptExportBtn: 'ایکسپورٹ',
    transcriptEmpty: 'ابھی کوئی ٹرانسکرپٹ نہیں', transcriptStart: 'بولنا شروع کریں تاکہ ٹرانسکرپٹ یہاں نظر آئے',
    participantsTitle: 'شرکاء', participantsEmpty: 'ابھی کوئی شریک نہیں', participantYou: 'آپ', participantHost: 'میزبان', participantGuest: 'مہمان', participantUnknown: 'نامعلوم',
    statusScreenShare: 'اسکرین شیئر کر رہے ہیں', statusCamOn: 'کیمرہ آن', statusCamOff: 'کیمرہ آف', statusMicOn: 'مائیک آن', statusMicOff: 'مائیک آف',
  },
  es: {
    tagline: 'TalkBridge', heroTitle: 'Reuniones sin', heroHighlight: 'Barreras del idioma',
    heroDesc: 'TalkBridge combina videollamadas con traducción de voz en tiempo real. Habla tu idioma mientras el otro te escucha en el suyo, al instante.',
    badgeHD: 'Video HD', badgeLink: 'Enlace de invitación', badgeTranslate: 'Traducción en tiempo real',
    createRoom: 'Crear nueva sala', joinPlaceholder: 'Ingresa el código de sala',
    step1: 'Iniciar reunión', step2: 'Compartir enlace', step3: 'Habla tu idioma', step4: 'Te entienden',
    featuresLabel: '// Características', footerDesc: 'Videoreuniones con traducción en tiempo real, sin barreras lingüísticas.',
    feat1Title: 'Videollamadas HD', feat1Desc: 'Videollamadas de alta calidad con cámara y audio',
    feat2Title: 'Traducción de voz', feat2Desc: 'Habla tu idioma, otros escuchan el suyo',
    feat3Title: 'Compartir pantalla', feat3Desc: 'Comparte tu pantalla con un clic',
    feat4Title: 'Chat traducido', feat4Desc: 'Mensajes de texto con traducción automática',
    feat5Title: '13+ idiomas', feat5Desc: 'Árabe, inglés, francés y más',
    feat6Title: 'Ultra rápido', feat6Desc: 'Traducción instantánea con IA',
    roomSetupTitle: 'Configurar sala', roomJoinTitle: 'Unirse a la sala', roomSetupDesc: 'Prepárate para una conversación traducida al instante',
    roomCodeLabel: 'Código de sala', nameLabel: 'Apodo', hostNamePlaceholder: 'Anfitrión', guestNamePlaceholder: 'Tu nombre',
    myLanguageLabel: 'Tu idioma', partnerLanguageLabel: 'Idioma del compañero',
    startButtonHost: 'Crear sala y conectar', startButtonGuest: 'Unirse a la sala ahora',
    waitingForGuest: 'Esperando al invitado...', connectingSecurely: 'Conectando de forma segura...',
    establishingP2P: 'Estableciendo túnel P2P encriptado y enlazando audio traducido',
    shareLinkPrompt: 'Comparte este enlace con tu invitado:', copyLink: 'Copiar enlace', linkCopied: '✓ Copiado con éxito',
    onlineCount: 'En línea', inviteBtn: 'Invitar', listeningStatus: 'Escuchando...', errorStatus: 'Error',
    synthesizingStatus: (name) => `🔊 ${name} está hablando...`,
    inviteModalTitle: 'Invitar a unirse', inviteModalActive: 'actualmente en línea',
    copyRoomLinkBtn: 'Copiar enlace', copyRoomCodeBtn: 'Copiar código', shareBtn: 'Compartir',
    themeToggleTooltipDark: 'Modo claro', themeToggleTooltipLight: 'Modo oscuro',
    langToggleTooltip: 'Cambiar idioma del sitio', siteLangLabel: 'Idioma del sitio',

    settingsTitle: 'Ajustes', settingsReady: '¡Listo! ✨', settingsReadyDesc: 'Todos los ajustes configurados',
    settingsAudioProvider: 'Proveedor de Audio', settingsEgyptVoice: '🇪🇬 Egipcio', settingsNormalVoice: '🔊 Normal', settingsLocalVoice: '🖥️ Local',
    settingsEgyptDesc: '✨ Voz árabe egipcia natural', settingsNormalDesc: 'Voz del navegador', settingsLocalDesc: 'Requiere servidor local',
    settingsVoiceId: 'ID de Voz', settingsSave: 'Guardar Ajustes',
    videoGridYou: '(Tú)', videoGridScreenShare: 'Compartir Pantalla', videoGridExpand: 'Expandir Pantalla',
    videoGridWaiting: 'Esperando a que otros se unan...', videoGridSharePrompt: 'Comparte el enlace de invitación para empezar',
    tabChat: 'Chat', tabTranscript: 'Transcripción', tabParticipants: 'Participantes',
    chatTitle: 'Chat', chatAutoTranslate: 'Autotraducir', chatEmpty: 'No hay mensajes aún', chatStart: '¡Inicia la conversación!',
    chatTranslationLabel: 'Traducción:', chatTranslating: 'Traduciendo...', chatInputPlaceholder: 'Escribe un mensaje...',
    transcriptTitle: 'Transcripción de Voz', transcriptExportTooltip: 'Exportar Transcripción', transcriptExportBtn: 'Exportar',
    transcriptEmpty: 'No hay transcripción aún', transcriptStart: 'Empieza a hablar para ver la transcripción aquí',
    participantsTitle: 'Participantes', participantsEmpty: 'No hay participantes aún', participantYou: 'Tú', participantHost: 'Anfitrión', participantGuest: 'Invitado', participantUnknown: 'Desconocido',
    statusScreenShare: 'Compartiendo pantalla', statusCamOn: 'Cámara encendida', statusCamOff: 'Cámara apagada', statusMicOn: 'Micrófono encendido', statusMicOff: 'Micrófono apagado',
  },
  fr: {
    tagline: 'TalkBridge', heroTitle: 'Réunions sans', heroHighlight: 'Barrières linguistiques',
    heroDesc: 'TalkBridge combine les appels vidéo avec la traduction vocale en temps réel. Parlez votre langue, l\'autre vous entend dans la sienne — instantanément.',
    badgeHD: 'Vidéo HD', badgeLink: 'Lien d\'invitation unique', badgeTranslate: 'Traduction en temps réel',
    createRoom: 'Créer une salle', joinPlaceholder: 'Entrez le code de la salle',
    step1: 'Démarrer', step2: 'Partager le lien', step3: 'Parlez', step4: 'Ils comprennent',
    featuresLabel: '// Fonctionnalités', footerDesc: 'Réunions vidéo avec traduction en temps réel, sans barrières linguistiques.',
    feat1Title: 'Appels vidéo HD', feat1Desc: 'Appels vidéo haute qualité avec caméra et audio',
    feat2Title: 'Traduction vocale', feat2Desc: 'Parlez votre langue, les autres entendent la leur',
    feat3Title: 'Partage d\'écran', feat3Desc: 'Partagez votre écran en un clic',
    feat4Title: 'Chat traduit', feat4Desc: 'Messages texte avec traduction automatique',
    feat5Title: '13+ langues', feat5Desc: 'Arabe, Anglais, Français et plus',
    feat6Title: 'Ultra rapide', feat6Desc: 'Traduction instantanée par IA',
    roomSetupTitle: 'Configurer la salle', roomJoinTitle: 'Rejoindre la salle', roomSetupDesc: 'Préparez-vous pour une conversation traduite instantanément',
    roomCodeLabel: 'Code de la salle', nameLabel: 'Pseudo', hostNamePlaceholder: 'Hôte', guestNamePlaceholder: 'Votre nom',
    myLanguageLabel: 'Votre langue', partnerLanguageLabel: 'Langue du partenaire',
    startButtonHost: 'Créer la salle et connecter', startButtonGuest: 'Rejoindre la salle',
    waitingForGuest: 'En attente de l\'invité...', connectingSecurely: 'Connexion sécurisée...',
    establishingP2P: 'Établissement du tunnel P2P chiffré et liaison de l\'audio traduit',
    shareLinkPrompt: 'Partagez ce lien avec votre invité :', copyLink: 'Copier le lien', linkCopied: '✓ Copié avec succès',
    onlineCount: 'En ligne', inviteBtn: 'Inviter', listeningStatus: 'Écoute...', errorStatus: 'Erreur',
    synthesizingStatus: (name) => `🔊 ${name} parle...`,
    inviteModalTitle: 'Inviter à rejoindre', inviteModalActive: 'actuellement en ligne',
    copyRoomLinkBtn: 'Copier le lien', copyRoomCodeBtn: 'Copier le code', shareBtn: 'Partager',
    themeToggleTooltipDark: 'Mode clair', themeToggleTooltipLight: 'Mode sombre',
    langToggleTooltip: 'Changer la langue du site', siteLangLabel: 'Langue du site',

    settingsTitle: 'Paramètres', settingsReady: 'Prêt à l\'emploi ! ✨', settingsReadyDesc: 'Tous les paramètres sont configurés',
    settingsAudioProvider: 'Fournisseur Audio', settingsEgyptVoice: '🇪🇬 Égyptien', settingsNormalVoice: '🔊 Normal', settingsLocalVoice: '🖥️ Local',
    settingsEgyptDesc: '✨ Voix arabe égyptienne naturelle', settingsNormalDesc: 'Voix du navigateur', settingsLocalDesc: 'Serveur local requis',
    settingsVoiceId: 'ID de Voix', settingsSave: 'Enregistrer',
    videoGridYou: '(Vous)', videoGridScreenShare: 'Partage d\'écran', videoGridExpand: 'Agrandir l\'écran',
    videoGridWaiting: 'En attente...', videoGridSharePrompt: 'Partagez le lien pour commencer',
    tabChat: 'Chat', tabTranscript: 'Transcription', tabParticipants: 'Participants',
    chatTitle: 'Chat', chatAutoTranslate: 'Traduction auto', chatEmpty: 'Aucun message', chatStart: 'Commencez !',
    chatTranslationLabel: 'Traduction :', chatTranslating: 'Traduction...', chatInputPlaceholder: 'Tapez un message...',
    transcriptTitle: 'Transcription', transcriptExportTooltip: 'Exporter', transcriptExportBtn: 'Exporter',
    transcriptEmpty: 'Aucune transcription', transcriptStart: 'Commencez à parler pour voir la transcription',
    participantsTitle: 'Participants', participantsEmpty: 'Aucun participant', participantYou: 'Vous', participantHost: 'Hôte', participantGuest: 'Invité', participantUnknown: 'Inconnu',
    statusScreenShare: 'Partage d\'écran en cours', statusCamOn: 'Caméra activée', statusCamOff: 'Caméra désactivée', statusMicOn: 'Micro activé', statusMicOff: 'Micro désactivé',
  },
  de: {
    tagline: 'TalkBridge', heroTitle: 'Meetings ohne', heroHighlight: 'Sprachbarrieren',
    heroDesc: 'TalkBridge kombiniert Videoanrufe mit Echtzeit-Sprachübersetzung. Sprechen Sie in Ihrer Sprache, während die andere Person Sie sofort in ihrer eigenen Sprache hört.',
    badgeHD: 'HD Video', badgeLink: 'Nur ein Einladungslink', badgeTranslate: 'Echtzeit-Übersetzung',
    createRoom: 'Neuen Raum erstellen', joinPlaceholder: 'Raumcode eingeben',
    step1: 'Meeting starten', step2: 'Link teilen', step3: 'Sprechen Sie Ihre Sprache', step4: 'Sie verstehen',
    featuresLabel: '// Funktionen', footerDesc: 'Videomeetings mit Echtzeitübersetzung, ohne Sprachbarrieren.',
    feat1Title: 'HD Videoanrufe', feat1Desc: 'Hochwertige Videoanrufe mit Kamera und Audio',
    feat2Title: 'Sprachübersetzung', feat2Desc: 'Sprechen Sie in Ihrer Sprache, andere hören ihre eigene',
    feat3Title: 'Bildschirmfreigabe', feat3Desc: 'Teilen Sie Ihren Bildschirm mit einem Klick',
    feat4Title: 'Übersetzter Chat', feat4Desc: 'Textnachrichten mit automatischer Übersetzung',
    feat5Title: '13+ Sprachen', feat5Desc: 'Arabisch, Englisch, Französisch und mehr',
    feat6Title: 'Blitzschnell', feat6Desc: 'Sofortige Übersetzung durch KI',
    roomSetupTitle: 'Raum einrichten', roomJoinTitle: 'Raum beitreten', roomSetupDesc: 'Bereiten Sie sich auf ein sofort übersetztes Gespräch vor',
    roomCodeLabel: 'Raumcode', nameLabel: 'Spitzname', hostNamePlaceholder: 'Gastgeber', guestNamePlaceholder: 'Ihr Name',
    myLanguageLabel: 'Ihre Sprache', partnerLanguageLabel: 'Sprache des Partners',
    startButtonHost: 'Raum erstellen & verbinden', startButtonGuest: 'Jetzt beitreten',
    waitingForGuest: 'Warten auf Gast...', connectingSecurely: 'Sichere Verbindung...',
    establishingP2P: 'Aufbau eines verschlüsselten P2P-Tunnels und Verknüpfung von übersetztem Audio',
    shareLinkPrompt: 'Teilen Sie diesen Link mit Ihrem Gast:', copyLink: 'Link kopieren', linkCopied: '✓ Erfolgreich kopiert',
    onlineCount: 'Online', inviteBtn: 'Einladen', listeningStatus: 'Hört zu...', errorStatus: 'Fehler',
    synthesizingStatus: (name) => `🔊 ${name} spricht...`,
    inviteModalTitle: 'Zum Beitreten einladen', inviteModalActive: 'derzeit online',
    copyRoomLinkBtn: 'Link kopieren', copyRoomCodeBtn: 'Raumcode kopieren', shareBtn: 'Teilen',
    settingsTitle: 'Einstellungen', settingsReady: 'Einsatzbereit! ✨', settingsReadyDesc: 'Alle Einstellungen sind konfiguriert',
    settingsAudioProvider: 'Audio-Anbieter', settingsEgyptVoice: '🇪🇬 Ägyptisch', settingsNormalVoice: '🔊 Normal', settingsLocalVoice: '🖥️ Lokal',
    settingsEgyptDesc: '✨ Natürliche ägyptisch-arabische Stimme', settingsNormalDesc: 'Integrierte Browser-Stimme', settingsLocalDesc: 'Lokaler Server erforderlich',
    settingsVoiceId: 'Stimmen-ID', settingsSave: 'Einstellungen speichern',

    videoGridYou: '(Sie)', videoGridScreenShare: 'Bildschirmfreigabe', videoGridExpand: 'Vollbild',
    videoGridWaiting: 'Warten auf den Beitritt anderer...', videoGridSharePrompt: 'Teilen Sie den Einladungslink, um zu beginnen',
    tabChat: 'Chat', tabTranscript: 'Transkript', tabParticipants: 'Teilnehmer',
    chatTitle: 'Chat', chatAutoTranslate: 'Auto-Übersetzen', chatEmpty: 'Noch keine Nachrichten', chatStart: 'Starten Sie die Unterhaltung!',
    chatTranslationLabel: 'Übersetzung:', chatTranslating: 'Übersetzen...', chatInputPlaceholder: 'Nachricht eingeben...',
    transcriptTitle: 'Sprachtranskript', transcriptExportTooltip: 'Transkript exportieren', transcriptExportBtn: 'Exportieren',
    transcriptEmpty: 'Noch kein Transkript', transcriptStart: 'Beginnen Sie zu sprechen, um das Transkript hier zu sehen',
    participantsTitle: 'Teilnehmer', participantsEmpty: 'Noch keine Teilnehmer', participantYou: 'Sie', participantHost: 'Gastgeber', participantGuest: 'Gast', participantUnknown: 'Unbekannt',
    statusScreenShare: 'Bildschirm wird geteilt', statusCamOn: 'Kamera an', statusCamOff: 'Kamera aus', statusMicOn: 'Mikrofon an', statusMicOff: 'Mikrofon aus',
    themeToggleTooltipDark: 'Zum hellen Modus wechseln', themeToggleTooltipLight: 'Zum dunklen Modus wechseln',
    langToggleTooltip: 'Seitensprache ändern', siteLangLabel: 'Seitensprache',
  },
  it: {
    tagline: 'TalkBridge', heroTitle: 'Riunioni senza', heroHighlight: 'Barriere linguistiche',
    heroDesc: 'TalkBridge combina videochiamate con traduzione vocale in tempo reale.',
    badgeHD: 'Video HD', badgeLink: 'Solo un link', badgeTranslate: 'Traduzione in tempo reale',
    createRoom: 'Crea Nuova Stanza', joinPlaceholder: 'Inserisci codice stanza',
    step1: 'Avvia riunione', step2: 'Condividi link', step3: 'Parla la tua lingua', step4: 'Loro capiscono',
    featuresLabel: '// Caratteristiche', footerDesc: 'Riunioni video con traduzione in tempo reale.',
    feat1Title: 'Videochiamate HD', feat1Desc: 'Videochiamate di alta qualità',
    feat2Title: 'Traduzione vocale', feat2Desc: 'Parla la tua lingua, gli altri sentono la loro',
    feat3Title: 'Condivisione schermo', feat3Desc: 'Condividi il tuo schermo',
    feat4Title: 'Chat tradotta', feat4Desc: 'Messaggi con traduzione',
    feat5Title: '13+ Lingue', feat5Desc: 'Arabo, Inglese, Francese e altro',
    feat6Title: 'Veloce', feat6Desc: 'Traduzione istantanea con IA',
    roomSetupTitle: 'Imposta Stanza', roomJoinTitle: 'Unisciti alla Stanza', roomSetupDesc: 'Preparati per una conversazione tradotta',
    roomCodeLabel: 'Codice Stanza', nameLabel: 'Tuo Nome', hostNamePlaceholder: 'Ospite', guestNamePlaceholder: 'Tuo Nome',
    myLanguageLabel: 'Tua Lingua', partnerLanguageLabel: 'Lingua del Partner',
    startButtonHost: 'Crea e Connetti', startButtonGuest: 'Unisciti Ora',
    waitingForGuest: 'In attesa...', connectingSecurely: 'Connessione in corso...',
    establishingP2P: 'Creazione tunnel P2P...',
    shareLinkPrompt: 'Condividi questo link:', copyLink: 'Copia Link', linkCopied: '✓ Copiato',
    onlineCount: 'Online', inviteBtn: 'Invita', listeningStatus: 'In ascolto...', errorStatus: 'Errore',
    synthesizingStatus: (name) => `🔊 ${name} sta parlando...`,
    inviteModalTitle: 'Invita a partecipare', inviteModalActive: 'online ora',
    copyRoomLinkBtn: 'Copia Link', copyRoomCodeBtn: 'Copia Codice', shareBtn: 'Condividi',
    themeToggleTooltipDark: 'Modalità chiara', themeToggleTooltipLight: 'Modalità scura',
    langToggleTooltip: 'Cambia lingua', siteLangLabel: 'Lingua sito',
    
    settingsTitle: 'Impostazioni', settingsReady: 'Pronto! ✨', settingsReadyDesc: 'Tutte le impostazioni configurate',
    settingsAudioProvider: 'Provider Audio', settingsEgyptVoice: '🇪🇬 Egiziano', settingsNormalVoice: '🔊 Normale', settingsLocalVoice: '🖥️ Locale',
    settingsEgyptDesc: '✨ Voce araba', settingsNormalDesc: 'Voce browser', settingsLocalDesc: 'Server locale richiesto',
    settingsVoiceId: 'ID Voce', settingsSave: 'Salva Impostazioni',
    videoGridYou: '(Tu)', videoGridScreenShare: 'Condivisione', videoGridExpand: 'Espandi',
    videoGridWaiting: 'In attesa...', videoGridSharePrompt: 'Condividi il link',
    tabChat: 'Chat', tabTranscript: 'Trascrizione', tabParticipants: 'Partecipanti',
    chatTitle: 'Chat', chatAutoTranslate: 'Traduci', chatEmpty: 'Nessun messaggio', chatStart: 'Inizia!',
    chatTranslationLabel: 'Traduzione:', chatTranslating: 'Traduzione...', chatInputPlaceholder: 'Scrivi...',
    transcriptTitle: 'Trascrizione', transcriptExportTooltip: 'Esporta', transcriptExportBtn: 'Esporta',
    transcriptEmpty: 'Nessuna trascrizione', transcriptStart: 'Parla per vedere il testo qui',
    participantsTitle: 'Partecipanti', participantsEmpty: 'Nessuno', participantYou: 'Tu', participantHost: 'Ospite', participantGuest: 'Invitato', participantUnknown: 'Sconosciuto',
    statusScreenShare: 'Condivisione', statusCamOn: 'Cam on', statusCamOff: 'Cam off', statusMicOn: 'Mic on', statusMicOff: 'Mic off',
  },
  ru: {
    tagline: 'TalkBridge', heroTitle: 'Встречи без', heroHighlight: 'языковых барьеров',
    heroDesc: 'Видеозвонки с переводом в реальном времени.',
    badgeHD: 'HD Видео', badgeLink: 'Один клик', badgeTranslate: 'Перевод',
    createRoom: 'Создать комнату', joinPlaceholder: 'Код комнаты',
    step1: 'Начать', step2: 'Поделиться', step3: 'Говорите', step4: 'Вас поймут',
    featuresLabel: '// Функции', footerDesc: 'Встречи с переводом.',
    feat1Title: 'Видео HD', feat1Desc: 'Отличное качество',
    feat2Title: 'Голосовой перевод', feat2Desc: 'Говорите на своем языке',
    feat3Title: 'Демонстрация экрана', feat3Desc: 'Делитесь экраном',
    feat4Title: 'Чат', feat4Desc: 'Текст с переводом',
    feat5Title: '13+ языков', feat5Desc: 'Английский, Русский и др.',
    feat6Title: 'Мгновенно', feat6Desc: 'Быстрый ИИ перевод',
    roomSetupTitle: 'Настройки', roomJoinTitle: 'Войти', roomSetupDesc: 'Приготовьтесь к разговору',
    roomCodeLabel: 'Код', nameLabel: 'Ваше имя', hostNamePlaceholder: 'Хост', guestNamePlaceholder: 'Ваше имя',
    myLanguageLabel: 'Ваш язык', partnerLanguageLabel: 'Язык партнера',
    startButtonHost: 'Создать', startButtonGuest: 'Войти',
    waitingForGuest: 'Ожидание...', connectingSecurely: 'Подключение...',
    establishingP2P: 'Установка соединения...',
    shareLinkPrompt: 'Поделитесь ссылкой:', copyLink: 'Копировать', linkCopied: '✓ Скопировано',
    onlineCount: 'Онлайн', inviteBtn: 'Пригласить', listeningStatus: 'Слушаю...', errorStatus: 'Ошибка',
    synthesizingStatus: (name) => `🔊 ${name} говорит...`,
    inviteModalTitle: 'Пригласить', inviteModalActive: 'сейчас онлайн',
    copyRoomLinkBtn: 'Копировать', copyRoomCodeBtn: 'Копировать код', shareBtn: 'Поделиться',
    themeToggleTooltipDark: 'Светлая тема', themeToggleTooltipLight: 'Темная тема',
    langToggleTooltip: 'Сменить язык', siteLangLabel: 'Язык сайта',
    
    settingsTitle: 'Настройки', settingsReady: 'Готово! ✨', settingsReadyDesc: 'Все настроено',
    settingsAudioProvider: 'Аудио', settingsEgyptVoice: '🇪🇬 Египет', settingsNormalVoice: '🔊 Обычный', settingsLocalVoice: '🖥️ Локальный',
    settingsEgyptDesc: 'Арабский', settingsNormalDesc: 'Браузер', settingsLocalDesc: 'Нужен сервер',
    settingsVoiceId: 'ID Голоса', settingsSave: 'Сохранить',
    videoGridYou: '(Вы)', videoGridScreenShare: 'Экран', videoGridExpand: 'Полный экран',
    videoGridWaiting: 'Ожидание...', videoGridSharePrompt: 'Поделитесь ссылкой',
    tabChat: 'Чат', tabTranscript: 'Текст', tabParticipants: 'Участники',
    chatTitle: 'Chat', chatAutoTranslate: 'Перевод', chatEmpty: 'Нет сообщений', chatStart: 'Начните!',
    chatTranslationLabel: 'Перевод:', chatTranslating: 'Перевод...', chatInputPlaceholder: 'Сообщение...',
    transcriptTitle: 'Текст', transcriptExportTooltip: 'Скачать', transcriptExportBtn: 'Скачать',
    transcriptEmpty: 'Пусто', transcriptStart: 'Начните говорить',
    participantsTitle: 'Участники', participantsEmpty: 'Никого', participantYou: 'Вы', participantHost: 'Хост', participantGuest: 'Гость', participantUnknown: 'Неизвестно',
    statusScreenShare: 'Экран', statusCamOn: 'Камера', statusCamOff: 'Без камеры', statusMicOn: 'Микрофон', statusMicOff: 'Без звука',
  },
  tr: {
    tagline: 'TalkBridge', heroTitle: 'Engelsiz', heroHighlight: 'Toplantılar',
    heroDesc: 'Gerçek zamanlı çeviri ile görüntülü görüşme.',
    badgeHD: 'HD Video', badgeLink: 'Tek link', badgeTranslate: 'Anında çeviri',
    createRoom: 'Oda Oluştur', joinPlaceholder: 'Oda Kodu',
    step1: 'Başlat', step2: 'Paylaş', step3: 'Konuş', step4: 'Anlasınlar',
    featuresLabel: '// Özellikler', footerDesc: 'Çevirili toplantılar.',
    feat1Title: 'HD Video', feat1Desc: 'Yüksek kalite',
    feat2Title: 'Ses Çevirisi', feat2Desc: 'Kendi dilinde konuş',
    feat3Title: 'Ekran Paylaşımı', feat3Desc: 'Ekراًى paylaş',
    feat4Title: 'Sohbet', feat4Desc: 'Çevirili mesajlaşma',
    feat5Title: '13+ Dil', feat5Desc: 'Türkçe, İngilizce vs.',
    feat6Title: 'Hızlı', feat6Desc: 'Anında yapay zeka',
    roomSetupTitle: 'Oda Ayarı', roomJoinTitle: 'Odaya Katıl', roomSetupDesc: 'Görüşmeye hazırlan',
    roomCodeLabel: 'Kod', nameLabel: 'Adın', hostNamePlaceholder: 'Kurucu', guestNamePlaceholder: 'Adın',
    myLanguageLabel: 'Senin Dilin', partnerLanguageLabel: 'Karşı Dil',
    startButtonHost: 'Oluştur', startButtonGuest: 'Katıl',
    waitingForGuest: 'Bekleniyor...', connectingSecurely: 'Bağlanıyor...',
    establishingP2P: 'Bağlantı kuruluyor...',
    shareLinkPrompt: 'Linki paylaş:', copyLink: 'Kopyala', linkCopied: '✓ Kopyalandı',
    onlineCount: 'Çevrimiçi', inviteBtn: 'Davet', listeningStatus: 'Dinliyor...', errorStatus: 'Hata',
    synthesizingStatus: (name) => `🔊 ${name} konuşuyor...`,
    inviteModalTitle: 'Davet et', inviteModalActive: 'çevrimiçi',
    copyRoomLinkBtn: 'Kopyala', copyRoomCodeBtn: 'Oda Kodunu Kopyala', shareBtn: 'Paylaş',
    themeToggleTooltipDark: 'Açık tema', themeToggleTooltipLight: 'Koyu tema',
    langToggleTooltip: 'Dil değiştir', siteLangLabel: 'Site dili',
    
    settingsTitle: 'Ayarlar', settingsReady: 'Hazır! ✨', settingsReadyDesc: 'Her şey tamam',
    settingsAudioProvider: 'Ses Sağlayıcı', settingsEgyptVoice: '🇪🇬 Mısır', settingsNormalVoice: '🔊 Normal', settingsLocalVoice: '🖥️ Yerel',
    settingsEgyptDesc: 'Arapça', settingsNormalDesc: 'Tarayıcı', settingsLocalDesc: 'Yerel sunucu',
    settingsVoiceId: 'Ses ID', settingsSave: 'Kaydet',
    videoGridYou: '(Sen)', videoGridScreenShare: 'Ekran', videoGridExpand: 'Tam ekran',
    videoGridWaiting: 'Bekleniyor...', videoGridSharePrompt: 'Linki paylaş',
    tabChat: 'Sohbet', tabTranscript: 'Döküm', tabParticipants: 'Kişiler',
    chatTitle: 'Sohbet', chatAutoTranslate: 'Çevir', chatEmpty: 'Mesaj yok', chatStart: 'Başla!',
    chatTranslationLabel: 'Çeviri:', chatTranslating: 'Çevriliyor...', chatInputPlaceholder: 'Mesaj...',
    transcriptTitle: 'Döküm', transcriptExportTooltip: 'İndir', transcriptExportBtn: 'İندير',
    transcriptEmpty: 'Yok', transcriptStart: 'Konuşmaya başla',
    participantsTitle: 'Kişiler', participantsEmpty: 'Kimse yok', participantYou: 'Sen', participantHost: 'Kurucu', participantGuest: 'Misafir', participantUnknown: 'Bilinmeyen',
    statusScreenShare: 'Ekran', statusCamOn: 'Kamera açık', statusCamOff: 'Kamera kapalı', statusMicOn: 'Mikrofon açık', statusMicOff: 'Mikrofon kapalı',
  },
  zh: {
    tagline: 'TalkBridge', heroTitle: '无障碍', heroHighlight: '会议',
    heroDesc: '实时翻译视频通话。',
    badgeHD: '高清视频', badgeLink: '一键邀请', badgeTranslate: '实时翻译',
    createRoom: '创建房间', joinPlaceholder: '输入房间号',
    step1: '开始会议', step2: '分享链接', step3: '说你的语言', step4: '对方理解',
    featuresLabel: '// 功能', footerDesc: '无语言障碍会议。',
    feat1Title: '高清通话', feat1Desc: '高质量视频',
    feat2Title: '语音翻译', feat2Desc: '各自说母语',
    feat3Title: '屏幕共享', feat3Desc: '分享屏幕',
    feat4Title: '聊天', feat4Desc: '自动翻译文本',
    feat5Title: '13+ 语言', feat5Desc: '中文, 英文等',
    feat6Title: '超快', feat6Desc: 'AI 实时翻译',
    roomSetupTitle: '房间设置', roomJoinTitle: '加入房间', roomSetupDesc: '准备通话',
    roomCodeLabel: '房间号', nameLabel: '昵称', hostNamePlaceholder: '主持人', guestNamePlaceholder: '你的名字',
    myLanguageLabel: '你的语言', partnerLanguageLabel: '对方语言',
    startButtonHost: '创建并连接', startButtonGuest: '立即加入',
    waitingForGuest: '等待中...', connectingSecurely: '连接中...',
    establishingP2P: '建立加密通道...',
    shareLinkPrompt: '分享链接：', copyLink: '复制链接', linkCopied: '✓ 已复制',
    onlineCount: '在线', inviteBtn: '邀请', listeningStatus: '倾听中...', errorStatus: '错误',
    synthesizingStatus: (name) => `🔊 ${name} 正在说话...`,
    inviteModalTitle: '邀请', inviteModalActive: '当前在线',
    copyRoomLinkBtn: '复制', copyRoomCodeBtn: '复制房号', shareBtn: '分享',
    themeToggleTooltipDark: '亮色', themeToggleTooltipLight: '暗色',
    langToggleTooltip: '更改语言', siteLangLabel: '网站语言',
    
    settingsTitle: '设置', settingsReady: '准备就绪! ✨', settingsReadyDesc: '所有设置已完成',
    settingsAudioProvider: '语音提供商', settingsEgyptVoice: '🇪🇬 埃及', settingsNormalVoice: '🔊 普通', settingsLocalVoice: '🖥️ 本地',
    settingsEgyptDesc: '阿拉伯语', settingsNormalDesc: '浏览器内置', settingsLocalDesc: '需要本地服务器',
    settingsVoiceId: '声音ID', settingsSave: '保存设置',
    videoGridYou: '(你)', videoGridScreenShare: '共享屏幕', videoGridExpand: '全屏',
    videoGridWaiting: '等待其他人加入...', videoGridSharePrompt: '分享链接开始',
    tabChat: '聊天', tabTranscript: '记录', tabParticipants: '成员',
    chatTitle: '聊天', chatAutoTranslate: '自动翻译', chatEmpty: '暂无消息', chatStart: '开始聊天！',
    chatTranslationLabel: '翻译:', chatTranslating: '翻译中...', chatInputPlaceholder: '输入消息...',
    transcriptTitle: '语音记录', transcriptExportTooltip: '导出记录', transcriptExportBtn: '导出',
    transcriptEmpty: '暂无记录', transcriptStart: '说话以显示记录',
    participantsTitle: '成员', participantsEmpty: '暂无成员', participantYou: '你', participantHost: '主持人', participantGuest: '访客', participantUnknown: '未知',
    statusScreenShare: '共享屏幕', statusCamOn: '摄像头开', statusCamOff: '摄像头关', statusMicOn: '麦克风开', statusMicOff: '麦克风关',
  },
  ja: {
    tagline: 'TalkBridge', heroTitle: '言葉の壁を越えた', heroHighlight: '会議',
    heroDesc: 'リアルタイム翻訳機能付きビデオ通話。',
    badgeHD: 'HDビデオ', badgeLink: 'リンク１つ', badgeTranslate: 'リアルタイム翻訳',
    createRoom: 'ルーム作成', joinPlaceholder: 'ルームコード',
    step1: '会議開始', step2: 'リンク共有', step3: 'あなたの言語で話す', step4: '相手が理解',
    featuresLabel: '// 機能', footerDesc: '言葉の壁のない会議。',
    feat1Title: 'HD通話', feat1Desc: '高品質ビデオ',
    feat2Title: '音声翻訳', feat2Desc: '各自の母国語で話す',
    feat3Title: '画面共有', feat3Desc: '画面を共有',
    feat4Title: 'チャット', feat4Desc: '自動翻訳テキスト',
    feat5Title: '13以上の言語', feat5Desc: '日本語, 英語など',
    feat6Title: '超高速', feat6Desc: 'AIリアルタイム翻訳',
    roomSetupTitle: 'ルーム設定', roomJoinTitle: '参加', roomSetupDesc: '通話の準備',
    roomCodeLabel: 'コード', nameLabel: '名前', hostNamePlaceholder: 'ホスト', guestNamePlaceholder: 'あなたの名前',
    myLanguageLabel: 'あなたの言語', partnerLanguageLabel: '相手の言語',
    startButtonHost: '作成して接続', startButtonGuest: '今すぐ参加',
    waitingForGuest: '待機中...', connectingSecurely: '接続中...',
    establishingP2P: 'P2P接続を確立中...',
    shareLinkPrompt: 'リンクを共有:', copyLink: 'リンクをコピー', linkCopied: '✓ コピー完了',
    onlineCount: 'オンライン', inviteBtn: '招待', listeningStatus: '聞き取り中...', errorStatus: 'エラー',
    synthesizingStatus: (name) => `🔊 ${name} が話しています...`,
    inviteModalTitle: '招待', inviteModalActive: 'オンライン',
    copyRoomLinkBtn: 'コピー', copyRoomCodeBtn: 'ルームコードをコピー', shareBtn: '共有',
    themeToggleTooltipDark: 'ライトモード', themeToggleTooltipLight: 'ダークモード',
    langToggleTooltip: '言語変更', siteLangLabel: 'サイト言語',
    
    settingsTitle: '設定', settingsReady: '準備完了! ✨', settingsReadyDesc: '設定が完了しました',
    settingsAudioProvider: '音声プロバイダ', settingsEgyptVoice: '🇪🇬 エジプト', settingsNormalVoice: '🔊 通常', settingsLocalVoice: '🖥️ ローカル',
    settingsEgyptDesc: 'アラビア語', settingsNormalDesc: 'ブラウザ音声', settingsLocalDesc: 'ローカルサーバー必須',
    settingsVoiceId: '音声ID', settingsSave: '保存',
    videoGridYou: '(あなた)', videoGridScreenShare: '画面共有', videoGridExpand: '全画面',
    videoGridWaiting: '待機中...', videoGridSharePrompt: 'リンクを共有して開始',
    tabChat: 'チャット', tabTranscript: '文字起こし', tabParticipants: '参加者',
    chatTitle: 'チャット', chatAutoTranslate: '自動翻訳', chatEmpty: 'メッセージなし', chatStart: '会話を開始!',
    chatTranslationLabel: '翻訳:', chatTranslating: '翻訳中...', chatInputPlaceholder: 'メッセージを入力...',
    transcriptTitle: '文字起こし', transcriptExportTooltip: '出力', transcriptExportBtn: '出力',
    transcriptEmpty: '記録なし', transcriptStart: '話すとここに表示されます',
    participantsTitle: '参加者', participantsEmpty: '参加者なし', participantYou: 'あなた', participantHost: 'ホスト', participantGuest: 'ゲスト', participantUnknown: '不明',
    statusScreenShare: '画面共有中', statusCamOn: 'カメラ オン', statusCamOff: 'カメラ オフ', statusMicOn: 'マイク オン', statusMicOff: 'マイク オフ',
  },
  ko: {
    tagline: 'TalkBridge', heroTitle: '언어 장벽 없는', heroHighlight: '회의',
    heroDesc: '실시간 번역 화상 통화.',
    badgeHD: 'HD 비디오', badgeLink: '단일 링크', badgeTranslate: '실시간 번역',
    createRoom: '방 만들기', joinPlaceholder: '방 코드',
    step1: '회의 시작', step2: '링크 공유', step3: '자신의 언어로 말하기', step4: '상대방이 이해함',
    featuresLabel: '// 기능', footerDesc: '장벽 없는 회의.',
    feat1Title: 'HD 통화', feat1Desc: '고품질 비디오',
    feat2Title: '음성 번역', feat2Desc: '각자의 모국어로 대화',
    feat3Title: '화면 공유', feat3Desc: '화면을 공유',
    feat4Title: '채팅', feat4Desc: '자동 번역 텍스트',
    feat5Title: '13개 이상의 언어', feat5Desc: '한국어, 영어 등',
    feat6Title: '초고속', feat6Desc: 'AI 실시간 번역',
    roomSetupTitle: '방 설정', roomJoinTitle: '방 참여', roomSetupDesc: '통화 준비',
    roomCodeLabel: '코드', nameLabel: '이름', hostNamePlaceholder: '호스트', guestNamePlaceholder: '당신의 이름',
    myLanguageLabel: '당신의 언어', partnerLanguageLabel: '상대방의 언어',
    startButtonHost: '생성 및 연결', startButtonGuest: '지금 참여',
    waitingForGuest: '대기 중...', connectingSecurely: '연결 중...',
    establishingP2P: 'P2P 연결 설정...',
    shareLinkPrompt: '링크 공유:', copyLink: '링크 복사', linkCopied: '✓ 복사됨',
    onlineCount: '온라인', inviteBtn: '초대', listeningStatus: '듣는 중...', errorStatus: '오류',
    synthesizingStatus: (name) => `🔊 ${name} 말하는 중...`,
    inviteModalTitle: '초대', inviteModalActive: '현재 온라인',
    copyRoomLinkBtn: '복사', copyRoomCodeBtn: '방 코드 복사', shareBtn: '공유',
    themeToggleTooltipDark: '라이트 모드', themeToggleTooltipLight: '다크 모드',
    langToggleTooltip: '언어 변경', siteLangLabel: '사이트 언어',
    
    settingsTitle: '설정', settingsReady: '준비 완료! ✨', settingsReadyDesc: '설정이 완료되었습니다',
    settingsAudioProvider: '오디오 제공자', settingsEgyptVoice: '🇪🇬 이집트', settingsNormalVoice: '🔊 일반', settingsLocalVoice: '🖥️ 로컬',
    settingsEgyptDesc: '아랍어', settingsNormalDesc: '브라우저 음성', settingsLocalDesc: '로컬 서버 필요',
    settingsVoiceId: '음성 ID', settingsSave: '저장',
    videoGridYou: '(나)', videoGridScreenShare: '화면 공유', videoGridExpand: '전체 화면',
    videoGridWaiting: '대기 중...', videoGridSharePrompt: '링크를 공유하여 시작',
    tabChat: '채팅', tabTranscript: '기록', tabParticipants: '참가자',
    chatTitle: '채팅', chatAutoTranslate: '자동 번역', chatEmpty: '메시지 없음', chatStart: '대화를 시작하세요!',
    chatTranslationLabel: '번역:', chatTranslating: '번역 중...', chatInputPlaceholder: '메시지 입력...',
    transcriptTitle: '음성 기록', transcriptExportTooltip: '내보내기', transcriptExportBtn: '내보내기',
    transcriptEmpty: '기록 없음', transcriptStart: '말을 하면 여기에 표시됩니다',
    participantsTitle: '참가자', participantsEmpty: '참가자 없음', participantYou: '나', participantHost: '호스트', participantGuest: '게스트', participantUnknown: '알 수 없음',
    statusScreenShare: '화면 공유 중', statusCamOn: '카메라 켜짐', statusCamOff: '카메라 꺼짐', statusMicOn: '마이크 켜짐', statusMicOff: '마이크 꺼짐',
  },
  hi: {
    tagline: 'TalkBridge', heroTitle: 'बिना किसी', heroHighlight: 'भाषा बाधा के',
    heroDesc: 'रीयल-टाइम अनुवाद के साथ वीडियो कॉल।',
    badgeHD: 'एचडी वीडियो', badgeLink: 'केवल एक लिंक', badgeTranslate: 'रीयल-टाइम अनुवाद',
    createRoom: 'नया रूम बनाएं', joinPlaceholder: 'रूम कोड दर्ज करें',
    step1: 'मीटिंग शुरू करें', step2: 'लिंक साझा करें', step3: 'अपनी भाषा बोलें', step4: 'वे समझते हैं',
    featuresLabel: '// विशेषताएँ', footerDesc: 'अनुवाद के साथ वीडियो मीटिंग।',
    feat1Title: 'एचडी कॉल', feat1Desc: 'उच्च गुणवत्ता वाला वीडियो',
    feat2Title: 'ध्वनि अनुवाद', feat2Desc: 'अपनी मातृभाषा में बोलें',
    feat3Title: 'स्क्रीन साझा करें', feat3Desc: 'अपनी स्क्रीन साझा करें',
    feat4Title: 'चैट', feat4Desc: 'स्वचालित अनुवाद पाठ',
    feat5Title: '13+ भाषाएँ', feat5Desc: 'हिंदी, अंग्रेजी आदि',
    feat6Title: 'अति तेज़', feat6Desc: 'AI रीयल-टाइम अनुवाद',
    roomSetupTitle: 'रूम सेट करें', roomJoinTitle: 'रूम में शामिल हों', roomSetupDesc: 'कॉल के लिए तैयार रहें',
    roomCodeLabel: 'कोड', nameLabel: 'आपका नाम', hostNamePlaceholder: 'मेजबान', guestNamePlaceholder: 'आपका नाम',
    myLanguageLabel: 'आपकी भाषा', partnerLanguageLabel: 'साथी की भाषा',
    startButtonHost: 'बनाएं और कनेक्ट करें', startButtonGuest: 'अभी शामिल हों',
    waitingForGuest: 'प्रतीक्षा हो रही है...', connectingSecurely: 'कनेكت हो रहा है...',
    establishingP2P: 'P2P कनेक्शन स्थापित हो रहा है...',
    shareLinkPrompt: 'लिंक साझा करें:', copyLink: 'लिंक कॉपी करें', linkCopied: '✓ कॉपी हो गया',
    onlineCount: 'ऑनलाइन', inviteBtn: 'आमंत्रित करें', listeningStatus: 'सुन रहा है...', errorStatus: 'त्रुटي',
    synthesizingStatus: (name) => `🔊 ${name} बोल रहा है...`,
    inviteModalTitle: 'आमंत्रित करें', inviteModalActive: 'अभी ऑनलाइन',
    copyRoomLinkBtn: 'कॉपी करें', copyRoomCodeBtn: 'रूम कोड कॉपी करें', shareBtn: 'साझा करें',
    themeToggleTooltipDark: 'लाइट मोड', themeToggleTooltipLight: 'डार्क मोड',
    langToggleTooltip: 'भाषा बदलें', siteLangLabel: 'साइट भाषा',
    
    settingsTitle: 'सेटिंग्स', settingsReady: 'तैयार! ✨', settingsReadyDesc: 'सभी सेटिंग्स कॉन्फ़िगर की गईं',
    settingsAudioProvider: 'ऑडियो प्रदाता', settingsEgyptVoice: '🇪🇬 मिस्र', settingsNormalVoice: '🔊 सामान्य', settingsLocalVoice: '🖥️ स्थानीय',
    settingsEgyptDesc: 'अरबी', settingsNormalDesc: 'ब्राउज़र आवाज़', settingsLocalDesc: 'स्थानीय सर्वर आवश्यक',
    settingsVoiceId: 'वॉयस आईडी', settingsSave: 'सहेजें',
    videoGridYou: '(आप)', videoGridScreenShare: 'स्क्रीन शेयर', videoGridExpand: 'फुल स्क्रीन',
    videoGridWaiting: 'प्रतीक्षा हो रही है...', videoGridSharePrompt: 'शुरू करने के लिए लिंक साझा करें',
    tabChat: 'चैट', tabTranscript: 'प्रतिलेख', tabParticipants: 'प्रतिभागी',
    chatTitle: 'चैट', chatAutoTranslate: 'अनुवाद', chatEmpty: 'कोई संदेश नहीं', chatStart: 'शुरू करें!',
    chatTranslationLabel: HindiTranslationLabel, chatTranslating: 'अनुवाद हो रहा है...', chatInputPlaceholder: 'संदेश...',
    transcriptTitle: 'प्रतिलेख', transcriptExportTooltip: 'निर्यात', transcriptExportBtn: 'निर्यात',
    transcriptEmpty: 'कोई प्रतिलेख नहीं', transcriptStart: 'बोलना शुरू करें',
    participantsTitle: HindiParticipantsTitle, participantsEmpty: 'कोई प्रतिभागी नहीं', participantYou: 'आप', participantHost: 'मेजबान', participantGuest: HindiParticipantGuest, participantUnknown: 'अज्ञात',
    statusScreenShare: 'स्क्रीन शेयर हो रही है', statusCamOn: 'कैमरा ऑन', statusCamOff: 'कैमरा ऑफ', statusMicOn: 'माइक ऑन', statusMicOff: 'माइक ऑफ',
  }
};

/** Returns translations for the given language code, falls back to English for missing keys */
export function getTranslations(langCode: string): UITranslations {
  const selected = translations[langCode] || translations['en'];
  return { ...translations['en'], ...selected } as UITranslations;
}
