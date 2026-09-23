/**
 * The Secret Letter Challenge — the duel from the design's own rulebook:
 *
 *   1. choose a secret letter  2. write it down  3. guess your rival's letter
 *   4. first to discover the letter wins
 *
 * Both sides really play.  The rival keeps its own candidate list, asks the
 * question that splits that list most evenly, and narrows it with the answer the
 * *player* gives — so the player has to genuinely know their own letter's
 * features (dots, tail, height, joining) to keep their secret safe.  Answering
 * a question about your own letter wrongly costs a heart and is corrected on the
 * spot, which is the teaching moment.
 */
import { LETTERS, letterByChar, type Letter } from '../data/letters';
import { WORDS } from '../data/words';
import { findLetter } from './arabic';
import { makeRng, sample, shuffle, type Rng } from './rng';

export interface Clue {
  id: string;
  msgKey: string;
  vars?: Record<string, string | number>;
  test: (l: Letter) => boolean;
}

const BASE_CLUES: Clue[] = [
  { id: 'hasDots', msgKey: 'clue.hasDots', test: (l) => l.dots.count > 0 },
  { id: 'dotsAbove', msgKey: 'clue.dotsAbove', test: (l) => l.dots.place === 'above' },
  { id: 'dotsBelow', msgKey: 'clue.dotsBelow', test: (l) => l.dots.place === 'below' },
  { id: 'oneDot', msgKey: 'clue.oneDot', test: (l) => l.dots.count === 1 },
  { id: 'threeDots', msgKey: 'clue.threeDots', test: (l) => l.dots.count === 3 },
  { id: 'descends', msgKey: 'clue.descends', test: (l) => l.descends },
  { id: 'tall', msgKey: 'clue.tall', test: (l) => l.tall },
  { id: 'joinsBoth', msgKey: 'clue.joinsBoth', test: (l) => l.joining === 'dual' },
];

function wordClue(wordAr: string): Clue {
  return {
    id: `inWord:${wordAr}`,
    msgKey: 'clue.inWord',
    vars: { word: wordAr },
    test: (l) => findLetter(wordAr, l.char).length > 0,
  };
}

/** The clue deck for a duel: feature questions plus a few "is it in this word?". */
export function clueDeck(candidates: string[], rng: Rng): Clue[] {
  const wordPool = WORDS.filter(
    (w) => w.difficulty <= 2 && candidates.some((c) => findLetter(w.ar, c).length > 0),
  );
  const wordClues = sample(rng, wordPool, 4).map((w) => wordClue(w.ar));
  // Keep only clues that actually split this candidate set — a question whose
  // answer is the same for every candidate teaches nothing.
  return [...BASE_CLUES, ...wordClues].filter((c) => splits(c, candidates));
}

function splits(clue: Clue, candidates: string[]): boolean {
  let yes = 0;
  for (const c of candidates) {
    const l = letterByChar(c);
    if (l && clue.test(l)) yes++;
  }
  return yes > 0 && yes < candidates.length;
}

/** How evenly a clue divides the candidates — 0 is a perfect split. */
export function imbalance(clue: Clue, candidates: string[]): number {
  let yes = 0;
  for (const c of candidates) {
    const l = letterByChar(c);
    if (l && clue.test(l)) yes++;
  }
  return Math.abs(candidates.length - 2 * yes);
}

export function applyClue(clue: Clue, candidates: string[], answer: boolean): string[] {
  return candidates.filter((c) => {
    const l = letterByChar(c);
    return !!l && clue.test(l) === answer;
  });
}

/** Truthful answer for a given secret. */
export function answerFor(clue: Clue, secret: string): boolean {
  const l = letterByChar(secret);
  return !!l && clue.test(l);
}

/**
 * The tiles both players choose from.  Always includes every letter of the world,
 * padded with visually similar letters so that the deduction has real substance.
 */
export function duelCandidates(worldLetters: string[], size: number, seed: number): string[] {
  const rng = makeRng(seed);
  const set = new Set(worldLetters);
  // First pad with letters confusable with the world's own letters …
  for (const ch of worldLetters) {
    for (const c of letterByChar(ch)?.confusableWith ?? []) {
      if (set.size >= size) break;
      set.add(c);
    }
  }
  // … then with anything else, so the grid is always full.
  for (const l of shuffle(rng, LETTERS)) {
    if (set.size >= size) break;
    set.add(l.char);
  }
  return shuffle(rng, [...set]).slice(0, Math.max(size, worldLetters.length));
}

export interface RivalState {
  /** What the rival still thinks the player's letter could be. */
  candidates: string[];
  /** Clues already spent, by id. */
  used: string[];
  secret: string;
}

export function makeRival(candidates: string[], seed: number): RivalState {
  const rng = makeRng(seed);
  const secret = shuffle(rng, candidates)[0];
  return { candidates: candidates.slice(), used: [], secret };
}

/**
 * How sharply the rival plays.  A rival that always asks the perfect question
 * beats a child every time, so only the last worlds get one: the early rival asks
 * a reasonable question rather than the best one, which leaves the learner the
 * time to reason their own way to the answer.
 */
export type RivalSkill = 'easy' | 'fair' | 'sharp';

export function skillForTier(tier: 'beginner' | 'intermediate' | 'advanced'): RivalSkill {
  return tier === 'beginner' ? 'easy' : tier === 'intermediate' ? 'fair' : 'sharp';
}

/** The clues still worth asking about a candidate set, best splitter first. */
export function rankClues(deck: Clue[], candidates: string[], used: string[] = []): Clue[] {
  return deck
    .filter((c) => !used.includes(c.id) && splits(c, candidates))
    .sort((a, b) => imbalance(a, candidates) - imbalance(b, candidates));
}

/** The rival's question for this turn, chosen according to its skill. */
export function rivalChooseClue(rival: RivalState, deck: Clue[], skill: RivalSkill = 'sharp'): Clue | null {
  const ranked = rankClues(deck, rival.candidates, rival.used);
  if (!ranked.length) return null;
  if (skill === 'sharp') return ranked[0];
  const rng = makeRng(rival.used.length * 7919 + rival.candidates.length + 1);
  if (skill === 'fair') return ranked[Math.floor(rng() * Math.ceil(ranked.length / 2))] ?? ranked[0];
  return ranked[Math.floor(rng() * ranked.length)] ?? ranked[0];
}

/** Does the rival commit to a guess this turn? */
export function rivalShouldGuess(rival: RivalState, deck: Clue[], skill: RivalSkill = 'sharp'): boolean {
  if (rival.candidates.length <= 1) return true;
  return !rivalChooseClue(rival, deck, skill);
}

export function rivalGuess(rival: RivalState, seed: number): string {
  return shuffle(makeRng(seed), rival.candidates)[0] ?? LETTERS[0].char;
}
