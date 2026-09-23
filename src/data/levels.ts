import { WORLDS, tierOfWorld, type Tier } from './worlds';
import { availablePositions } from '../game/arabic';
import { letterByChar } from './letters';
import type { LevelDef, LevelPhase } from '../game/types';

/**
 * Levels are generated from world data, so adding a letter to a world in
 * worlds.ts adds a fully-formed level — no game logic has to change.
 *
 * The phase list is what makes each level feel different: it rotates through
 * challenge types by tier, and drops any phase the target letter cannot support
 * (there is no "medial form" lesson for د, because د has no medial form).
 */

/** Phase menus per tier. The engine trims these against the letter's real forms. */
const PHASES: Record<Tier, LevelPhase[]> = {
  beginner: [
    { type: 'LETTER_DISCOVERY', count: 1 },
    { type: 'LETTER_IDENTIFICATION', count: 4 },
    { type: 'SAME_LETTER', count: 3 },
    { type: 'SHAPE_SHIFTER', count: 1 },
    { type: 'WORD_HUNT', count: 3 },
    { type: 'POSITION_DETECTION', count: 3 },
  ],
  intermediate: [
    { type: 'LETTER_DISCOVERY', count: 1 },
    { type: 'SAME_LETTER', count: 3 },
    { type: 'SHAPE_SHIFTER', count: 1 },
    { type: 'CONTEXTUAL_FORM', count: 3 },
    { type: 'SHAPE_MATCH', count: 1 },
    { type: 'WORD_HUNT', count: 3 },
    { type: 'POSITION_DETECTION', count: 3 },
    { type: 'SIMILAR_LETTER', count: 3 },
    { type: 'WORD_BUILD', count: 1 },
  ],
  advanced: [
    { type: 'LETTER_DISCOVERY', count: 1 },
    { type: 'SHAPE_SHIFTER', count: 1 },
    { type: 'CONTEXTUAL_FORM', count: 4 },
    { type: 'SHAPE_MATCH', count: 1 },
    { type: 'SIMILAR_LETTER', count: 4 },
    { type: 'WORD_HUNT', count: 3 },
    { type: 'WORD_BUILD', count: 2 },
    { type: 'TIMED_RECOGNITION', count: 8, seconds: 30 },
  ],
};

/** Phases that only make sense when the letter actually has more than one form. */
const FORM_PHASES = new Set(['SHAPE_SHIFTER', 'CONTEXTUAL_FORM', 'SHAPE_MATCH']);

function phasesFor(letter: string, tier: Tier): LevelPhase[] {
  const forms = availablePositions(letter).length;
  const l = letterByChar(letter);
  const hasConfusables = (l?.confusableWith.length ?? 0) > 0;
  return PHASES[tier].filter((p) => {
    if (FORM_PHASES.has(p.type) && forms < 2) return false;
    if (p.type === 'SIMILAR_LETTER' && !hasConfusables) return false;
    return true;
  });
}

function letterLevel(worldId: string, letter: string, index: number, tier: Tier): LevelDef {
  const forms = availablePositions(letter).length;
  return {
    id: `${worldId}-${index}`,
    worldId,
    index,
    kind: 'letter',
    targetLetters: [letter],
    tier,
    phases: phasesFor(letter, tier),
    masteryAccuracy: tier === 'beginner' ? 0.85 : 0.9,
    rewards: {
      coins: 40 + forms * 10 + (tier === 'advanced' ? 30 : tier === 'intermediate' ? 15 : 0),
      xp: 60 + forms * 15,
    },
  };
}

/**
 * The world boss, straight out of the design's own rulebook:
 *   1. choose a secret letter   2. write it down   3. guess your rival's letter
 *   4. first to discover it wins 5. name 3 words containing the letter
 *   6. at the beginning, the middle, or the end of the word
 */
function bossLevel(worldId: string, letters: string[], index: number, tier: Tier): LevelDef {
  return {
    id: `${worldId}-boss`,
    worldId,
    index,
    kind: 'boss',
    targetLetters: letters,
    tier,
    phases: [
      { type: 'BOSS_SECRET_LETTER', count: 1 },
      { type: 'BOSS_THREE_WORDS', count: 3, seconds: tier === 'beginner' ? 60 : tier === 'intermediate' ? 45 : 30 },
    ],
    masteryAccuracy: 0.9,
    rewards: { coins: 150 + index * 10, xp: 220 },
  };
}

export const LEVELS: LevelDef[] = WORLDS.flatMap((w) => {
  const tier = tierOfWorld(w.order);
  const letterLevels = w.letters.map((ch, i) => letterLevel(w.id, ch, i + 1, tier));
  return [...letterLevels, bossLevel(w.id, w.letters, w.letters.length + 1, tier)];
});

export const LEVEL_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function levelsOfWorld(worldId: string): LevelDef[] {
  return LEVELS.filter((l) => l.worldId === worldId);
}

/** Flat play order across the whole adventure — used for "next level". */
export const LEVEL_ORDER: string[] = LEVELS.map((l) => l.id);

export function nextLevelId(id: string): string | undefined {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 ? LEVEL_ORDER[i + 1] : undefined;
}

/**
 * Unlock rule: the first level is always open; after that a level opens when the
 * level before it in play order is completed.  A world is open when its first
 * level is open.
 */
export function isLevelUnlocked(id: string, completed: Set<string>): boolean {
  const i = LEVEL_ORDER.indexOf(id);
  if (i <= 0) return i === 0;
  return completed.has(LEVEL_ORDER[i - 1]);
}

export function isWorldUnlocked(worldId: string, completed: Set<string>): boolean {
  const first = levelsOfWorld(worldId)[0];
  return !!first && isLevelUnlocked(first.id, completed);
}
