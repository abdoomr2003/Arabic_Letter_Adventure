import type { LevelDef } from './types';

/** Combo tier from a streak length — 5 correct ⇒ ×2, 10 ⇒ ×3, 15 ⇒ ×4. */
export function comboMultiplier(streak: number): number {
  if (streak >= 15) return 4;
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  return 1;
}

/** Answers that land fast earn a small bonus — capped so speed never dominates. */
export function speedBonus(ms: number, base: number): number {
  if (ms <= 0) return 0;
  if (ms < 2000) return Math.round(base * 0.25);
  if (ms < 4000) return Math.round(base * 0.1);
  return 0;
}

export function questionScore(base: number, streak: number, ms: number): number {
  const mult = comboMultiplier(streak);
  return base * mult + speedBonus(ms, base);
}

export interface LevelOutcome {
  score: number;
  correct: number;
  asked: number;
  mistakes: number;
  bestCombo: number;
  livesLeft: number;
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
  xp: number;
}

/**
 * Stars come from real performance, never from reaching the last screen:
 *   ★   finished the level
 *   ★★  finished with good accuracy and at least one heart to spare
 *   ★★★ hit the level's mastery accuracy without losing a heart
 */
export function gradeLevel(
  level: LevelDef,
  raw: { score: number; correct: number; asked: number; bestCombo: number; livesLeft: number; maxLives: number },
): LevelOutcome {
  const asked = Math.max(1, raw.asked);
  const accuracy = raw.correct / asked;
  const mistakes = asked - raw.correct;
  let stars: 0 | 1 | 2 | 3 = 1;
  if (accuracy >= 0.7 && raw.livesLeft >= 2) stars = 2;
  if (accuracy >= level.masteryAccuracy && raw.livesLeft === raw.maxLives) stars = 3;

  const coins = Math.round(level.rewards.coins * (0.6 + 0.2 * stars));
  const xp = Math.round(level.rewards.xp * (0.7 + 0.15 * stars));

  return {
    score: raw.score,
    correct: raw.correct,
    asked,
    mistakes,
    bestCombo: raw.bestCombo,
    livesLeft: raw.livesLeft,
    accuracy,
    stars,
    coins,
    xp,
  };
}

/** Player level from total XP — a gentle curve so early levels come quickly. */
export function playerLevel(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 200;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return { level, into: rest, need };
}
