/**
 * Sound Effects Utility
 * يستخدم AudioContext لتوليد أصوات التنبيهات بدون ملفات خارجية
 */

let audioCtx: AudioContext | null = null;

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// صوت دخول شخص للاجتماع
export function playJoinSound() {
  try {
    const ctx = getContext();
    const t = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // نغمة تصاعدية لطيفة
    osc1.frequency.setValueAtTime(440, t);
    osc1.frequency.exponentialRampToValueAtTime(880, t + 0.2);
    
    osc2.frequency.setValueAtTime(554.37, t); // C#
    osc2.frequency.exponentialRampToValueAtTime(1108.73, t + 0.2);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.5);
    osc2.stop(t + 0.5);
  } catch (e) {
    console.error('Failed to play join sound', e);
  }
}

// صوت استلام رسالة في الدردشة
export function playMessageSound() {
  try {
    const ctx = getContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  } catch (e) {
    console.error('Failed to play message sound', e);
  }
}

// صوت بدء مشاركة الشاشة
export function playScreenShareSound() {
  try {
    const ctx = getContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square';
    
    // نغمة مستقبلية سريعة
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.setValueAtTime(400, t + 0.1);
    osc.frequency.setValueAtTime(500, t + 0.2);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gainNode.gain.setValueAtTime(0.1, t + 0.25);
    gainNode.gain.linearRampToValueAtTime(0.01, t + 0.4);

    // فلتر لتقليل حدة الصوت المربع (Square wave)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);
  } catch (e) {
    console.error('Failed to play screen share sound', e);
  }
}

// صوت خروج شخص من الاجتماع
export function playLeaveSound() {
  try {
    const ctx = getContext();
    const t = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // نغمة تنازلية حزينة قليلاً
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.exponentialRampToValueAtTime(440, t + 0.2);
    
    osc2.frequency.setValueAtTime(1108.73, t); // C#
    osc2.frequency.exponentialRampToValueAtTime(554.37, t + 0.2);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.5);
    osc2.stop(t + 0.5);
  } catch (e) {
    console.error('Failed to play leave sound', e);
  }
}
