/**
 * The only place in the app that talks to localStorage.
 * Everything else goes through the game state.
 */
import type { SaveFile, Settings, Profile, Progress } from './types';

const KEY = 'arabic-letter-adventure/save';
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  lang: 'ar',
  sound: true,
  music: false,
  reducedMotion: false,
  transliteration: true,
  highContrast: false,
};

export const DEFAULT_PROFILE: Profile = {
  name: '',
  avatar: '🧑‍🚀',
  createdAt: Date.now(),
};

export const DEFAULT_PROGRESS: Progress = {
  xp: 0,
  coins: 0,
  totalScore: 0,
  levels: {},
  mastery: {},
  unlockedRewards: [],
  bestCombo: 0,
  wordsCompleted: 0,
  lastPlayed: 0,
};

export function defaultSave(): SaveFile {
  return {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    profile: { ...DEFAULT_PROFILE, createdAt: Date.now() },
    progress: { ...DEFAULT_PROGRESS, levels: {}, mastery: {}, unlockedRewards: [] },
  };
}

function available(): boolean {
  try {
    const k = '__alaprobe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const HAS_STORAGE = typeof window !== 'undefined' && available();

export function load(): SaveFile {
  if (!HAS_STORAGE) return defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    if (!parsed || typeof parsed !== 'object') return defaultSave();
    const base = defaultSave();
    return {
      version: VERSION,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      progress: { ...base.progress, ...(parsed.progress ?? {}) },
    };
  } catch {
    return defaultSave();
  }
}

let pending: number | null = null;

/** Debounced write — gameplay updates state far more often than we need to save. */
export function save(data: SaveFile): void {
  if (!HAS_STORAGE) return;
  if (pending !== null) window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
    } catch {
      /* quota or private mode — the game keeps working, it just will not persist */
    }
  }, 250);
}

export function saveNow(data: SaveFile): void {
  if (!HAS_STORAGE) return;
  if (pending !== null) { window.clearTimeout(pending); pending = null; }
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
  } catch { /* ignore */ }
}

export function clear(): void {
  if (!HAS_STORAGE) return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const storageAvailable = HAS_STORAGE;
