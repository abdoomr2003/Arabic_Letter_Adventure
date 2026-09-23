import {
  availablePositions, hasPosition, sameLetter, type Position, type Slot,
} from './arabic';
import { ALL_CHARS, letterByChar } from '../data/letters';
import {
  wordsWithLetter, wordsWithLetterAt, wordsWithForm, type Word, type WordHit,
} from '../data/words';
import { msg } from '../data/i18n';
import { makeRng, pick, sample, shuffle, type Rng } from './rng';
import type { ChallengeType, LevelDef, Option, Question } from './types';

/* ------------------------------------------------------------------ helpers */

const POS_KEY: Record<Position, string> = {
  isolated: 'pos.isolated',
  initial: 'pos.initial',
  medial: 'pos.medial',
  final: 'pos.final',
};
const SLOT_KEY: Record<Slot, string> = {
  start: 'slot.start',
  middle: 'slot.middle',
  end: 'slot.end',
};

export const positionLabelKey = (p: Position) => POS_KEY[p];
export const slotLabelKey = (s: Slot) => SLOT_KEY[s];

let uid = 0;
const nextId = () => `q${++uid}`;

function letterOptions(
  rng: Rng,
  target: string,
  distractors: string[],
  render: (char: string) => Option['render'],
  total = 4,
): Option[] {
  const wrong = sample(rng, distractors.filter((c) => !sameLetter(c, target)), total - 1);
  const opts: Option[] = [
    { id: 'o0', render: render(target), correct: true, letter: target },
    ...wrong.map((c, i) => ({ id: `o${i + 1}`, render: render(c), correct: false, letter: c })),
  ];
  return shuffle(rng, opts);
}

/** Distractor pool: prefer visually confusable letters, then the rest. */
function distractorPool(target: string, tier: LevelDef['tier']): string[] {
  const l = letterByChar(target);
  const confusable = l?.confusableWith ?? [];
  const others = ALL_CHARS.filter((c) => !sameLetter(c, target) && !confusable.includes(c));
  if (tier === 'beginner') return [...confusable.slice(0, 1), ...others];
  if (tier === 'intermediate') return [...confusable, ...others];
  return [...confusable, ...confusable, ...others]; // confusables weighted for advanced
}

const maxDiff = (tier: LevelDef['tier']): 1 | 2 | 3 =>
  tier === 'beginner' ? 1 : tier === 'intermediate' ? 2 : 3;

/* ------------------------------------------------------------ the generators */

function qLetterIdentification(rng: Rng, target: string, tier: LevelDef['tier']): Question {
  const pool = distractorPool(target, tier);
  return {
    id: nextId(),
    type: 'LETTER_IDENTIFICATION',
    targetLetter: target,
    prompt: msg('q.findLetter', { letter: target }),
    options: letterOptions(rng, target, pool, (char) => ({ kind: 'letter', char })),
    need: 1,
    difficulty: 1,
    teachCorrect: msg('fb.correct'),
    value: 100,
  };
}

/** GAME 2 — "Which of these shapes belongs to ب?" */
function qSameLetter(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const positions = availablePositions(target).filter((p) => p !== 'isolated');
  if (!positions.length) return null;
  const position = pick(rng, positions);
  const pool = distractorPool(target, tier).filter((c) => hasPosition(c, position));
  if (pool.length < 3) return null;
  return {
    id: nextId(),
    type: 'SAME_LETTER',
    targetLetter: target,
    position,
    prompt: msg('q.findForm', { letter: target }),
    subPrompt: msg(POS_KEY[position]),
    options: letterOptions(rng, target, pool, (char) => ({ kind: 'form', char, position })),
    need: 1,
    difficulty: 2,
    teachCorrect: msg('fb.correctSame', { name: letterByChar(target)?.nameAr ?? target }),
    value: 130,
  };
}

/** "Where in a word is this shape used?" — form ➜ position. */
function qContextualForm(rng: Rng, target: string): Question | null {
  const positions = availablePositions(target);
  if (positions.length < 2) return null;
  const position = pick(rng, positions);
  const options: Option[] = shuffle(
    rng,
    (['isolated', 'initial', 'medial', 'final'] as Position[])
      .filter((p) => positions.includes(p))
      .map((p, i) => ({
        id: `p${i}`,
        render: { kind: 'position', position: p } as Option['render'],
        correct: p === position,
      })),
  );
  if (options.length < 2) return null;
  return {
    id: nextId(),
    type: 'CONTEXTUAL_FORM',
    targetLetter: target,
    position,
    prompt: msg('q.whichForm', { letter: target }),
    options,
    need: 1,
    difficulty: 2,
    teachCorrect: msg('fb.correct'),
    value: 130,
  };
}

/** GAME 3 — position detector: where is the letter inside this word? */
function qPositionDetection(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const hits = wordsWithLetter(target).filter((h) => h.word.difficulty <= maxDiff(tier));
  if (!hits.length) return null;
  const hit = pick(rng, hits);
  const options: Option[] = shuffle(
    rng,
    (['start', 'middle', 'end'] as Slot[]).map((s, i) => ({
      id: `s${i}`,
      render: { kind: 'slot', slot: s } as Option['render'],
      correct: s === hit.slot,
    })),
  );
  return {
    id: nextId(),
    type: 'POSITION_DETECTION',
    targetLetter: target,
    word: hit.word,
    slot: hit.slot,
    position: hit.position,
    prompt: msg('q.positionOf', { letter: target }),
    options,
    need: 1,
    difficulty: hit.word.difficulty,
    teachCorrect: msg('fb.correctPos', { letter: target, where: `«${SLOT_KEY[hit.slot]}»` }),
    value: 140,
  };
}

/** GAME 4 — collect every shape that belongs to the target letter. */
function qShapeMatch(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const positions = availablePositions(target);
  if (positions.length < 2) return null;
  const mine: Option[] = positions.map((p, i) => ({
    id: `m${i}`,
    render: { kind: 'form', char: target, position: p },
    correct: true,
    letter: target,
  }));
  const pool = distractorPool(target, tier);
  const decoys: Option[] = [];
  const wanted = Math.min(positions.length + 2, 6);
  for (const c of pool) {
    if (decoys.length >= wanted) break;
    const cp = availablePositions(c);
    decoys.push({
      id: `d${decoys.length}`,
      render: { kind: 'form', char: c, position: pick(rng, cp) },
      correct: false,
      letter: c,
    });
  }
  if (!decoys.length) return null;
  return {
    id: nextId(),
    type: 'SHAPE_MATCH',
    targetLetter: target,
    prompt: msg('q.matchAll', { letter: target }),
    options: shuffle(rng, [...mine, ...decoys]),
    need: mine.length,
    difficulty: 2,
    teachCorrect: msg('disc.sameLetter'),
    value: 200,
  };
}

/** GAME 5 — hunt the letter inside a word (the options are the word's letters). */
function qWordHunt(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const hits = wordsWithLetter(target).filter((h) => h.word.difficulty <= maxDiff(tier));
  if (!hits.length) return null;
  const hit = pick(rng, hits);
  return {
    id: nextId(),
    type: 'WORD_HUNT',
    targetLetter: target,
    word: hit.word,
    slot: hit.slot,
    position: hit.position,
    prompt: msg('q.wordHunt', { letter: target }),
    // Options are generated by the challenge component from the word itself,
    // because the tappable units are the rendered letters of the word.
    options: [],
    need: 1,
    difficulty: hit.word.difficulty,
    teachCorrect: msg('fb.correctHunt', { letter: target, where: `«${SLOT_KEY[hit.slot]}»` }),
    value: 150,
  };
}

/** §9 — similar-letter discrimination, always drawn from the confusable family. */
function qSimilarLetter(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const l = letterByChar(target);
  if (!l || !l.confusableWith.length) return null;
  const inForm = tier !== 'beginner' && availablePositions(target).length > 2;
  const position: Position = inForm ? pick(rng, ['initial', 'medial', 'final'] as Position[]) : 'isolated';
  const pool = l.confusableWith.filter((c) => hasPosition(c, position));
  if (pool.length < 2) return null;
  return {
    id: nextId(),
    type: 'SIMILAR_LETTER',
    targetLetter: target,
    position,
    prompt: msg('q.similar', { letter: target }),
    options: letterOptions(
      rng, target, pool,
      (char) => (position === 'isolated'
        ? { kind: 'letter', char }
        : { kind: 'form', char, position }),
      Math.min(4, pool.length + 1),
    ),
    need: 1,
    difficulty: 3,
    teachCorrect: msg('fb.correct'),
    value: 180,
  };
}

/** GAME 6 — build the word: the letters must be placed in the right order. */
function qWordBuild(rng: Rng, target: string, tier: LevelDef['tier']): Question | null {
  const hits = wordsWithLetter(target).filter(
    (h) => h.word.difficulty <= maxDiff(tier) && h.total >= 3 && h.total <= 5,
  );
  if (!hits.length) return null;
  const hit = pick(rng, hits);
  return {
    id: nextId(),
    type: 'WORD_BUILD',
    targetLetter: target,
    word: hit.word,
    prompt: msg('q.buildWord', { word: hit.word.ar }),
    subPrompt: msg('q.buildWordHint'),
    options: [],
    need: 1,
    difficulty: hit.word.difficulty,
    teachCorrect: msg('fb.correctWord', { word: hit.word.ar, meaning: hit.word.en }),
    value: 220,
  };
}

/** Rapid-fire recognition for the timed round. */
function qTimed(rng: Rng, target: string, tier: LevelDef['tier']): Question {
  const positions = availablePositions(target);
  const position = pick(rng, positions);
  const pool = distractorPool(target, tier).filter((c) => hasPosition(c, position));
  return {
    id: nextId(),
    type: 'TIMED_RECOGNITION',
    targetLetter: target,
    position,
    prompt: msg('q.timed', { letter: target }),
    options: letterOptions(
      rng, target, pool.length >= 3 ? pool : ALL_CHARS.filter((c) => hasPosition(c, position)),
      (char) => ({ kind: 'form', char, position }),
    ),
    need: 1,
    difficulty: 2,
    teachCorrect: msg('fb.correct'),
    value: 90,
  };
}

/* --------------------------------------------------------------- shape shifter */

export interface ShapeShiftStep {
  position: Position;
  /** A real word in which the letter takes exactly this form. */
  example?: WordHit;
}

/**
 * GAME 7 — the signature mechanic. Returns the ordered transformation steps.
 *
 * Each step gets a *different* word where possible, so the learner sees the letter
 * take each shape in its own context rather than staring at one word four times.
 */
export function shapeShiftSteps(letter: string, tier: LevelDef['tier']): ShapeShiftStep[] {
  const used = new Set<string>();
  return availablePositions(letter).map((position) => {
    const easy = wordsWithForm(letter, position, maxDiff(tier));
    const any = wordsWithForm(letter, position);
    const fresh = easy.find((h) => !used.has(h.word.ar))
      ?? any.find((h) => !used.has(h.word.ar))
      ?? easy[0] ?? any[0];
    if (fresh) used.add(fresh.word.ar);
    return { position, example: fresh };
  });
}

/* --------------------------------------------------------- the public builder */

export interface BuiltPhase {
  type: ChallengeType;
  seconds?: number;
  questions: Question[];
}

/**
 * Turn a level definition into concrete, playable questions.
 *
 * `focus` lets the adaptive system bias generation: letters the learner keeps
 * getting wrong get extra questions in the phases that target their weakness.
 */
export function buildLevel(level: LevelDef, seed: number, focus?: { extraSimilar?: boolean; extraForms?: boolean }): BuiltPhase[] {
  const rng = makeRng(seed);
  const out: BuiltPhase[] = [];
  const letters = level.targetLetters;

  for (const phase of level.phases) {
    if (phase.type === 'LETTER_DISCOVERY') {
      out.push({ type: phase.type, questions: [] });
      continue;
    }
    if (phase.type === 'SHAPE_SHIFTER') {
      out.push({ type: phase.type, questions: [] });
      continue;
    }
    if (phase.type === 'BOSS_SECRET_LETTER' || phase.type === 'BOSS_THREE_WORDS') {
      out.push({ type: phase.type, seconds: phase.seconds, questions: [] });
      continue;
    }

    let count = phase.count;
    if (focus?.extraSimilar && phase.type === 'SIMILAR_LETTER') count += 2;
    if (focus?.extraForms && (phase.type === 'SAME_LETTER' || phase.type === 'CONTEXTUAL_FORM')) count += 2;

    const questions: Question[] = [];
    let guard = 0;
    while (questions.length < count && guard++ < count * 8) {
      const target = pick(rng, letters);
      const q = generateOne(phase.type, rng, target, level.tier);
      if (!q) break;
      // avoid two identical prompts back to back
      const prev = questions[questions.length - 1];
      if (prev && prev.word?.ar === q.word?.ar && prev.position === q.position && prev.type === q.type) continue;
      questions.push(q);
    }
    if (questions.length) out.push({ type: phase.type, seconds: phase.seconds, questions });
  }
  return out;
}

function generateOne(
  type: ChallengeType, rng: Rng, target: string, tier: LevelDef['tier'],
): Question | null {
  switch (type) {
    case 'LETTER_IDENTIFICATION': return qLetterIdentification(rng, target, tier);
    case 'SAME_LETTER': return qSameLetter(rng, target, tier) ?? qLetterIdentification(rng, target, tier);
    case 'CONTEXTUAL_FORM': return qContextualForm(rng, target);
    case 'POSITION_DETECTION': return qPositionDetection(rng, target, tier);
    case 'SHAPE_MATCH': return qShapeMatch(rng, target, tier);
    case 'WORD_HUNT': return qWordHunt(rng, target, tier);
    case 'SIMILAR_LETTER': return qSimilarLetter(rng, target, tier);
    case 'WORD_BUILD': return qWordBuild(rng, target, tier);
    case 'TIMED_RECOGNITION': return qTimed(rng, target, tier);
    default: return null;
  }
}

/* ------------------------------------------------ boss: three-word challenge */

export interface ThreeWordSlot {
  slot: Slot;
  /** Candidate words offered to the player — exactly one group is correct. */
  choices: Word[];
  answer: Word;
}

/**
 * Build the three-word round.  The correct answer is checked against the real
 * word analysis, so a "correct" choice always genuinely has the letter there.
 */
export function buildThreeWords(letter: string, seed: number, tier: LevelDef['tier']): ThreeWordSlot[] {
  const rng = makeRng(seed);
  const slots: Slot[] = ['start', 'middle', 'end'];
  const used = new Set<string>();
  const out: ThreeWordSlot[] = [];
  for (const slot of slots) {
    const good = wordsWithLetterAt(letter, slot, maxDiff(tier)).map((h) => h.word)
      .filter((w) => !used.has(w.ar));
    const fallback = wordsWithLetterAt(letter, slot).map((h) => h.word).filter((w) => !used.has(w.ar));
    const pool = good.length ? good : fallback;
    if (!pool.length) continue;
    const answer = pick(rng, pool);
    used.add(answer.ar);
    // Distractors: words that contain the letter but in a *different* slot —
    // this is what makes the round teach position rather than recognition.
    const otherSlot = wordsWithLetter(letter)
      .filter((h) => h.slot !== slot && !used.has(h.word.ar))
      .map((h) => h.word);
    const decoys = sample(rng, dedupe(otherSlot), 3);
    out.push({ slot, answer, choices: shuffle(rng, [answer, ...decoys]) });
  }
  return out;
}

function dedupe(ws: Word[]): Word[] {
  const seen = new Set<string>();
  return ws.filter((w) => (seen.has(w.ar) ? false : (seen.add(w.ar), true)));
}
