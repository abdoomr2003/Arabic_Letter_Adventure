/**
 * Arabic joining / shaping utilities.
 *
 * The rule of this module: the *identity* of a letter is always its plain Unicode
 * code point (e.g. "ب" U+0628).  A "contextual form" is never stored as a separate
 * character and is never faked with CSS.  Instead we hand the real letter to the
 * browser's own shaping engine surrounded by ZERO WIDTH JOINER (U+200D), which is
 * precisely what the Unicode standard defines ZWJ for:
 *
 *   isolated : ب
 *   initial  : ب + ZWJ
 *   medial   : ZWJ + ب + ZWJ
 *   final    : ZWJ + ب
 *
 * Because the shaping engine does the work, letters with restricted joining
 * behaviour (ا د ذ ر ز و …) automatically render correctly: asking for the
 * "initial" form of د simply yields the isolated glyph, because د does not join
 * to the letter that follows it.  We therefore never invent four forms for a
 * letter that only has two.
 *
 * Reference: Unicode Core Spec, chapter 9 (Middle Eastern scripts / Arabic Cursive
 * Joining) — https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-9/
 */

export const ZWJ = '‍';
export const TATWEEL = 'ـ';

/** Where a letter sits inside a word. */
export type Position = 'isolated' | 'initial' | 'medial' | 'final';

/**
 * Arabic cursive joining classes we care about.
 *  - 'dual'  : joins on both sides (D)  → 4 forms
 *  - 'right' : joins only to the preceding letter (R) → 2 forms (isolated/final)
 *  - 'none'  : never joins (U) → 1 form
 */
export type JoiningType = 'dual' | 'right' | 'none';

/** Joining class per Unicode ArabicShaping.txt, for the characters this game uses. */
const JOINING: Record<string, JoiningType> = {
  // Right-joining (no initial / medial forms)
  'ا': 'right', 'أ': 'right', 'إ': 'right', 'آ': 'right',
  'د': 'right', 'ذ': 'right', 'ر': 'right', 'ز': 'right',
  'و': 'right', 'ؤ': 'right', 'ة': 'right', 'ى': 'right',
  // Non-joining
  'ء': 'none',
  // Everything else in the alphabet is dual-joining
  'ب': 'dual', 'ت': 'dual', 'ث': 'dual', 'ج': 'dual', 'ح': 'dual', 'خ': 'dual',
  'س': 'dual', 'ش': 'dual', 'ص': 'dual', 'ض': 'dual', 'ط': 'dual', 'ظ': 'dual',
  'ع': 'dual', 'غ': 'dual', 'ف': 'dual', 'ق': 'dual', 'ك': 'dual', 'ل': 'dual',
  'م': 'dual', 'ن': 'dual', 'ه': 'dual', 'ي': 'dual', 'ئ': 'dual',
};

export function joiningType(letter: string): JoiningType {
  return JOINING[letter] ?? 'dual';
}

/** The positions that actually produce a distinct shape for this letter. */
export function availablePositions(letter: string): Position[] {
  switch (joiningType(letter)) {
    case 'dual':
      return ['isolated', 'initial', 'medial', 'final'];
    case 'right':
      return ['isolated', 'final'];
    case 'none':
      return ['isolated'];
  }
}

/** True when the letter genuinely has a distinct glyph for that position. */
export function hasPosition(letter: string, position: Position): boolean {
  return availablePositions(letter).includes(position);
}

/**
 * Render one contextual form of a letter, using real Unicode joining control.
 * Never returns a presentation-form code point (U+FExx) — the base letter is kept.
 */
export function shapeForm(letter: string, position: Position): string {
  switch (position) {
    case 'isolated': return letter;
    case 'initial': return letter + ZWJ;
    case 'medial': return ZWJ + letter + ZWJ;
    case 'final': return ZWJ + letter;
  }
}

/** All the *distinct* forms of a letter, in teaching order. */
export function allForms(letter: string): { position: Position; text: string }[] {
  return availablePositions(letter).map((position) => ({
    position,
    text: shapeForm(letter, position),
  }));
}

const DIACRITICS = /[ً-ٰٟـ]/g;

/** Strip harakat (and tatweel) so we can compare letter skeletons. */
export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, '');
}

/** Split an Arabic word into letters, keeping each letter's diacritics attached. */
export function splitLetters(word: string): { base: string; full: string; index: number }[] {
  const out: { base: string; full: string; index: number }[] = [];
  for (const ch of word) {
    if (/[ً-ٰٟ]/.test(ch)) {
      if (out.length) out[out.length - 1].full += ch;
      continue;
    }
    if (ch === TATWEEL) continue;
    out.push({ base: ch, full: ch, index: out.length });
  }
  return out;
}

/** Letters that are "the same letter" for matching purposes (alef variants etc.). */
const EQUIVALENT: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ئ': 'ي',
  'ؤ': 'و',
  'ة': 'ه',
};

export function normalizeLetter(letter: string): string {
  return EQUIVALENT[letter] ?? letter;
}

export function sameLetter(a: string, b: string): boolean {
  return normalizeLetter(a) === normalizeLetter(b);
}

/**
 * Work out which contextual form each letter of a word is actually rendered in,
 * by applying the real joining rules rather than guessing from the index.
 *
 * A letter is joined to its right neighbour (the previous letter in reading order)
 * when that neighbour is dual- or right-joining; it is joined to its left
 * neighbour (the next letter) when the letter itself is dual-joining and the
 * next letter can be joined to.
 */
export function analyzeWord(word: string): {
  base: string;
  full: string;
  index: number;
  position: Position;
}[] {
  const letters = splitLetters(word);
  return letters.map((l, i) => {
    const prev = i > 0 ? letters[i - 1].base : null;
    const next = i < letters.length - 1 ? letters[i + 1].base : null;
    const selfType = joiningType(l.base);
    // Joins backwards (to the previous letter) if the previous letter can join forwards.
    const joinsPrev = prev !== null && joiningType(prev) === 'dual' && selfType !== 'none';
    // Joins forwards (to the next letter) if this letter is dual-joining and a letter follows.
    const joinsNext = next !== null && selfType === 'dual';
    let position: Position;
    if (joinsPrev && joinsNext) position = 'medial';
    else if (joinsPrev) position = 'final';
    else if (joinsNext) position = 'initial';
    else position = 'isolated';
    return { ...l, position };
  });
}

/** Simple word-slot description used by the "where is the letter?" challenges. */
export type Slot = 'start' | 'middle' | 'end';

/** Which slot of the word does index `i` of `n` letters fall in? */
export function slotOf(index: number, total: number): Slot {
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'middle';
}

/** Find every occurrence of a target letter inside a word, with real form + slot. */
export function findLetter(word: string, target: string) {
  const analysed = analyzeWord(word);
  return analysed
    .map((l, i) => ({ ...l, slot: slotOf(i, analysed.length) }))
    .filter((l) => sameLetter(l.base, target));
}

/**
 * Does `word` contain `target` in the requested slot?
 * Used by the Three Words boss challenge — validated against the real word,
 * never against a hand-written answer key.
 */
export function wordHasLetterAt(word: string, target: string, slot: Slot): boolean {
  return findLetter(word, target).some((hit) => hit.slot === slot);
}

/** Build the joined rendering of a partial word (used by Build-the-Word). */
export function joinLetters(letters: string[]): string {
  return letters.join('');
}

/** RTL isolate wrapper so Arabic never reflows surrounding English UI. */
export const RLI = '⁧';
export const PDI = '⁩';
export function isolateRtl(text: string): string {
  return RLI + text + PDI;
}

/**
 * Character offsets of each letter inside a word, diacritics attached.
 *
 * The UI needs this to make individual letters of a word tappable *without*
 * splitting the word into separate elements — splitting would break the shaping
 * run and the letters would stop joining.  Instead the word is rendered as one
 * text node and these offsets are turned into DOM Ranges that are measured, so
 * the joined rendering is exactly what the learner sees.
 */
export interface LetterSpan {
  base: string;
  index: number;
  /** [start, end) offsets into the original string. */
  start: number;
  end: number;
}

export function letterSpans(word: string): LetterSpan[] {
  const out: LetterSpan[] = [];
  let i = 0;
  for (const ch of word) {
    const size = ch.length;
    if (/[ً-ٰٟ]/.test(ch)) {
      if (out.length) out[out.length - 1].end = i + size;
      i += size;
      continue;
    }
    if (ch === TATWEEL) { i += size; continue; }
    out.push({ base: ch, index: out.length, start: i, end: i + size });
    i += size;
  }
  return out;
}
