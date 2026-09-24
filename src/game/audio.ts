/**
 * Sound.
 *
 * Effects are synthesised with the Web Audio API, so they are real sound with no
 * asset download.  Letter pronunciation uses the browser's own speech synthesis
 * when an Arabic voice is installed — no external service is contacted, and if no
 * Arabic voice exists the speaker control reports itself as unavailable rather
 * than pretending to play something.
 *
 * Recorded audio can be dropped in later without touching call sites: put files
 * at the paths in `Letter.audio` and register them with `registerClip`.
 */

type Sfx = 'click' | 'correct' | 'wrong' | 'combo' | 'win' | 'lose' | 'coin' | 'tick' | 'reveal';

let ctx: AudioContext | null = null;
let enabled = true;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { ctx = null; }
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Browsers require a gesture before audio starts; call this from the first tap. */
export function unlockAudio() {
  const c = audioCtx();
  if (c && c.state === 'suspended') void c.resume();
}

interface ToneSpec { f: number; to?: number; t: number; type?: OscillatorType; gain?: number; delay?: number }

const SPECS: Record<Sfx, ToneSpec[]> = {
  click: [{ f: 620, t: 0.05, type: 'triangle', gain: 0.1 }],
  correct: [
    { f: 660, t: 0.1, type: 'sine', gain: 0.14 },
    { f: 880, t: 0.14, type: 'sine', gain: 0.14, delay: 0.08 },
  ],
  wrong: [{ f: 220, to: 150, t: 0.26, type: 'sawtooth', gain: 0.09 }],
  combo: [
    { f: 784, t: 0.08, type: 'square', gain: 0.08 },
    { f: 988, t: 0.08, type: 'square', gain: 0.08, delay: 0.07 },
    { f: 1319, t: 0.16, type: 'square', gain: 0.08, delay: 0.14 },
  ],
  win: [
    { f: 523, t: 0.12, type: 'sine', gain: 0.14 },
    { f: 659, t: 0.12, type: 'sine', gain: 0.14, delay: 0.11 },
    { f: 784, t: 0.12, type: 'sine', gain: 0.14, delay: 0.22 },
    { f: 1047, t: 0.3, type: 'sine', gain: 0.16, delay: 0.33 },
  ],
  lose: [
    { f: 392, t: 0.16, type: 'triangle', gain: 0.12 },
    { f: 294, t: 0.16, type: 'triangle', gain: 0.12, delay: 0.15 },
    { f: 196, t: 0.34, type: 'triangle', gain: 0.12, delay: 0.3 },
  ],
  coin: [
    { f: 1047, t: 0.06, type: 'square', gain: 0.07 },
    { f: 1568, t: 0.12, type: 'square', gain: 0.07, delay: 0.05 },
  ],
  tick: [{ f: 1200, t: 0.03, type: 'square', gain: 0.05 }],
  reveal: [{ f: 300, to: 900, t: 0.35, type: 'sine', gain: 0.1 }],
};

export function playSfx(name: Sfx) {
  if (!enabled) return;
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const now = c.currentTime;
  for (const s of SPECS[name]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = now + (s.delay ?? 0);
    osc.type = s.type ?? 'sine';
    osc.frequency.setValueAtTime(s.f, start);
    if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, start + s.t);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(s.gain ?? 0.12, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + s.t);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + s.t + 0.05);
  }
}

/* ------------------------------------------------------------ pronunciation */

const clips = new Map<string, string>();

/** Register a recorded clip for an id, e.g. registerClip('letters/baa-name', url). */
export function registerClip(id: string, url: string) {
  clips.set(id, url);
}

function voices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try { return window.speechSynthesis.getVoices(); } catch { return []; }
}

export function arabicVoice(): SpeechSynthesisVoice | null {
  return voices().find((v) => v.lang?.toLowerCase().startsWith('ar')) ?? null;
}

/** True when the game can actually pronounce Arabic on this device. */
export function canPronounce(): boolean {
  return clips.size > 0 || arabicVoice() !== null;
}

/**
 * Say an Arabic string.  Returns false when nothing could be played, so the UI
 * can show the speaker as unavailable instead of doing nothing silently.
 */
export function pronounce(text: string, clipId?: string): boolean {
  if (!enabled) return false;
  if (clipId && clips.has(clipId)) {
    const el = new Audio(clips.get(clipId));
    void el.play().catch(() => undefined);
    return true;
  }
  const voice = arabicVoice();
  if (!voice || typeof window === 'undefined' || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** Voices load asynchronously in some browsers; let the UI re-check when they do. */
export function onVoicesReady(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => undefined;
  const handler = () => cb();
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}
