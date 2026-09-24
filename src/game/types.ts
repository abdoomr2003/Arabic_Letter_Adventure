import type { Position, Slot } from './arabic';
import type { Word } from '../data/words';

export type Lang = 'ar' | 'en';

/** Every challenge the engine knows how to render. */
export type ChallengeType =
  | 'LETTER_DISCOVERY'
  | 'LETTER_IDENTIFICATION'
  | 'SAME_LETTER'
  | 'CONTEXTUAL_FORM'
  | 'SHAPE_SHIFTER'
  | 'POSITION_DETECTION'
  | 'SHAPE_MATCH'
  | 'WORD_HUNT'
  | 'WORD_BUILD'
  | 'SIMILAR_LETTER'
  | 'TIMED_RECOGNITION'
  | 'BOSS_SECRET_LETTER'
  | 'BOSS_THREE_WORDS';

/** How one option should be drawn. */
export type OptionRender =
  | { kind: 'letter'; char: string }
  | { kind: 'form'; char: string; position: Position }
  | { kind: 'word'; word: Word; highlightIndex?: number }
  | { kind: 'slot'; slot: Slot }
  | { kind: 'position'; position: Position }
  | { kind: 'text'; ar: string; en: string };

export interface Option {
  id: string;
  render: OptionRender;
  correct: boolean;
  /** The letter this option actually is — used for "almost, this is ت" feedback. */
  letter?: string;
}

/** A localisable message, resolved against the string table at render time. */
export interface Msg {
  key: string;
  vars?: Record<string, string | number>;
}

export interface Question {
  id: string;
  type: ChallengeType;
  targetLetter: string;
  prompt: Msg;
  /** Secondary line under the prompt (optional). */
  subPrompt?: Msg;
  options: Option[];
  /** How many options must be picked. 1 for normal MCQ, >1 for matching. */
  need: number;
  word?: Word;
  slot?: Slot;
  /** Every slot the target letter occupies in `word` — more than one for words like توت. */
  slots?: Slot[];
  position?: Position;
  difficulty: 1 | 2 | 3;
  /** Taught after a correct answer. */
  teachCorrect: Msg;
  /** Base score value before combo / speed bonuses. */
  value: number;
}

export interface LevelPhase {
  type: ChallengeType;
  /** How many questions of this type. */
  count: number;
  /** Seconds, only for timed phases. */
  seconds?: number;
}

export interface LevelDef {
  id: string;
  worldId: string;
  /** 1-based index within the world. */
  index: number;
  kind: 'letter' | 'boss';
  targetLetters: string[];
  tier: 'beginner' | 'intermediate' | 'advanced';
  phases: LevelPhase[];
  /** Accuracy (0–1) needed for the third star. */
  masteryAccuracy: number;
  rewards: { coins: number; xp: number };
}

export interface LevelRecord {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  bestAccuracy: number;
  bestCombo: number;
  plays: number;
}

/** Per-letter mastery, used by the adaptive difficulty system. */
export interface LetterMastery {
  seen: number;
  correct: number;
  /** Mistakes broken down by what the learner got wrong. */
  formErrors: number;
  similarErrors: number;
  wordErrors: number;
  /** Rolling mean response time in ms. */
  avgMs: number;
  /** 0–1, drives whether the learner is pushed toward harder concepts. */
  mastery: number;
}

export interface Settings {
  lang: Lang;
  sound: boolean;
  reducedMotion: boolean;
  transliteration: boolean;
  highContrast: boolean;
}

export interface Profile {
  name: string;
  avatar: string;
  createdAt: number;
}

export interface Progress {
  xp: number;
  coins: number;
  totalScore: number;
  levels: Record<string, LevelRecord>;
  mastery: Record<string, LetterMastery>;
  unlockedRewards: string[];
  bestCombo: number;
  wordsCompleted: number;
  lastPlayed: number;
}

export interface SaveFile {
  version: number;
  settings: Settings;
  profile: Profile;
  progress: Progress;
}
