/**
 * Adaptive difficulty.
 *
 * The goal is conceptual, not just faster: a learner who keeps confusing ب / ت / ث
 * gets more similar-letter work; a learner who has isolated letters down gets
 * pushed toward contextual forms, and then toward words.
 */
import type { ChallengeType, LetterMastery, Progress } from './types';

export const EMPTY_MASTERY: LetterMastery = {
  seen: 0, correct: 0, formErrors: 0, similarErrors: 0, wordErrors: 0, avgMs: 0, mastery: 0,
};

export function masteryOf(progress: Progress, letter: string): LetterMastery {
  return progress.mastery[letter] ?? EMPTY_MASTERY;
}

const FORM_TYPES: ChallengeType[] = ['SAME_LETTER', 'CONTEXTUAL_FORM', 'SHAPE_MATCH', 'SHAPE_SHIFTER'];
const WORD_TYPES: ChallengeType[] = ['WORD_HUNT', 'WORD_BUILD', 'POSITION_DETECTION', 'BOSS_THREE_WORDS'];

export function recordAnswer(
  prev: LetterMastery,
  opts: { correct: boolean; type: ChallengeType; ms: number },
): LetterMastery {
  const seen = prev.seen + 1;
  const correct = prev.correct + (opts.correct ? 1 : 0);
  const avgMs = prev.avgMs === 0 ? opts.ms : Math.round(prev.avgMs * 0.7 + opts.ms * 0.3);
  const next: LetterMastery = {
    seen,
    correct,
    formErrors: prev.formErrors + (!opts.correct && FORM_TYPES.includes(opts.type) ? 1 : 0),
    similarErrors: prev.similarErrors + (!opts.correct && opts.type === 'SIMILAR_LETTER' ? 1 : 0),
    wordErrors: prev.wordErrors + (!opts.correct && WORD_TYPES.includes(opts.type) ? 1 : 0),
    avgMs,
    mastery: 0,
  };
  next.mastery = computeMastery(next);
  return next;
}

/**
 * 0–1.  Accuracy is the backbone; confidence grows with exposure so a single
 * lucky answer never reads as mastery.
 */
function computeMastery(m: LetterMastery): number {
  if (m.seen === 0) return 0;
  const accuracy = m.correct / m.seen;
  const confidence = Math.min(1, m.seen / 12);
  return Math.round(accuracy * confidence * 100) / 100;
}

export interface Focus {
  extraSimilar: boolean;
  extraForms: boolean;
}

/** What should this level lean on, given what the learner keeps getting wrong? */
export function focusFor(progress: Progress, letters: string[]): Focus {
  let similar = 0;
  let forms = 0;
  for (const ch of letters) {
    const m = masteryOf(progress, ch);
    if (m.seen >= 4) {
      if (m.similarErrors >= 2) similar++;
      if (m.formErrors >= 2) forms++;
    }
  }
  return { extraSimilar: similar > 0, extraForms: forms > 0 };
}

/** Letters the learner should revisit — shown on the profile. */
export function strugglingLetters(progress: Progress, limit = 5): string[] {
  return Object.entries(progress.mastery)
    .filter(([, m]) => m.seen >= 4 && m.mastery < 0.6)
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .slice(0, limit)
    .map(([ch]) => ch);
}

export function masteredLetters(progress: Progress): string[] {
  return Object.entries(progress.mastery)
    .filter(([, m]) => m.seen >= 6 && m.mastery >= 0.75)
    .map(([ch]) => ch);
}

/** Accuracy specifically on similar-letter questions, across all letters. */
export function similarAccuracy(progress: Progress): number | null {
  let errors = 0;
  let seen = 0;
  for (const m of Object.values(progress.mastery)) {
    errors += m.similarErrors;
    seen += m.seen;
  }
  if (seen === 0) return null;
  return Math.max(0, 1 - errors / seen);
}

/**
 * Starting hearts.  Beginners get a little more room; the number never changes
 * mid-level, so the HUD always means what it says.
 */
export function livesFor(tier: 'beginner' | 'intermediate' | 'advanced'): number {
  return tier === 'beginner' ? 3 : tier === 'intermediate' ? 3 : 3;
}
