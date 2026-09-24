/**
 * Content self-check.  Run with `npm run check:content`.
 *
 * Verifies that the derived (never hand-written) letter/word index can actually
 * feed every challenge the level data asks for: each letter needs example words
 * for each *real* slot, and each letter's contextual forms must match its
 * Unicode joining class.
 */
import { LETTERS } from '../src/data/letters';
import { availablePositions, joiningType, allForms, analyzeWord } from '../src/game/arabic';
import { WORDS, wordsWithLetterAt, wordsWithLetter } from '../src/data/words';
import { WORLDS } from '../src/data/worlds';
import { BADGES } from '../src/data/rewards';
import { AVATARS } from '../src/game/persistence';

let problems = 0;
const warn = (m: string) => {
  problems++;
  console.log('  ✗ ' + m);
};

console.log(`\nWords in bank: ${WORDS.length}   Letters: ${LETTERS.length}\n`);

// 1. Joining class sanity.
for (const l of LETTERS) {
  const forms = allForms(l.char);
  const expected = joiningType(l.char) === 'dual' ? 4 : joiningType(l.char) === 'right' ? 2 : 1;
  if (forms.length !== expected) warn(`${l.char} produced ${forms.length} forms, expected ${expected}`);
}

// 2. Slot coverage — every letter needs start/middle/end examples where possible.
console.log('Slot coverage (start / middle / end):');
for (const l of LETTERS) {
  const s = wordsWithLetterAt(l.char, 'start').length;
  const m = wordsWithLetterAt(l.char, 'middle').length;
  const e = wordsWithLetterAt(l.char, 'end').length;
  const flag = s === 0 || m === 0 || e === 0 ? '  <-- GAP' : '';
  console.log(`  ${l.char} ${l.nameEn.padEnd(12)} ${String(s).padStart(2)} / ${String(m).padStart(2)} / ${String(e).padStart(2)}${flag}`);
  if (s === 0) warn(`${l.char} has no word starting with it`);
  if (m === 0) warn(`${l.char} has no word with it in the middle`);
  if (e === 0) warn(`${l.char} has no word ending with it`);
  if (wordsWithLetter(l.char).length < 3) warn(`${l.char} appears in fewer than 3 words`);
}

// 3. Contextual-form coverage for dual-joining letters.
console.log('\nContextual forms actually observed in real words:');
for (const l of LETTERS) {
  const seen = new Set(wordsWithLetter(l.char).map((h) => h.position));
  const want = availablePositions(l.char);
  const missing = want.filter((p) => !seen.has(p));
  if (missing.length) {
    console.log(`  ${l.char} missing in-word examples for: ${missing.join(', ')}`);
  }
}

// 4. Known-good joining analyses — the rules must keep producing these.
console.log('\nJoining analysis of reference words:');
const CASES: [string, string][] = [
  ['بَاب', 'ب:initial ا:final ب:isolated'],
  ['كِتَاب', 'ك:initial ت:medial ا:final ب:isolated'],
  ['مَكْتَب', 'م:initial ك:medial ت:medial ب:final'],
  ['وَرْد', 'و:isolated ر:isolated د:isolated'],
  ['ذِئْب', 'ذ:isolated ئ:initial ب:final'],
  // A dual-joining letter before a non-joining one stays FINAL, not medial.
  ['شَيْء', 'ش:initial ي:final ء:isolated'],
  ['ضَوْء', 'ض:initial و:final ء:isolated'],
  ['سَمَاء', 'س:initial م:medial ا:final ء:isolated'],
];
for (const [word, expected] of CASES) {
  const got = analyzeWord(word).map((l) => `${l.base}:${l.position}`).join(' ');
  if (got === expected) console.log(`  ✓ ${word} → ${got}`);
  else warn(`${word} analysed as "${got}", expected "${expected}"`);
}

// 5. Every word must analyse without throwing and must contain only known letters.
const known = new Set(LETTERS.map((x) => x.char).concat(['أ', 'إ', 'آ', 'ة', 'ى', 'ء', 'ئ', 'ؤ']));
for (const w of WORDS) {
  for (const l of analyzeWord(w.ar)) {
    if (!known.has(l.base)) warn(`word ${w.ar} contains unknown character "${l.base}" (U+${l.base.codePointAt(0)!.toString(16)})`);
  }
}

// 6. One entry per word — duplicates skew random picks and pools.
const seenWords = new Set<string>();
for (const w of WORDS) {
  if (seenWords.has(w.ar)) warn(`word ${w.ar} is listed more than once`);
  seenWords.add(w.ar);
}

// 7. Every icon must be a widely supported emoji. Emoji 12+ blocks and ZWJ
//    sequences render as tofu or split in two on older Windows / Android.
const MODERN_EMOJI = /[\u{1FA70}-\u{1FAFF}\u{1F6D5}-\u{1F6DF}\u{1F7E0}-\u{1F7FF}\u{1F90C}-\u{1F90F}‍]/u;
const icons: [string, string | undefined][] = [
  ...WORDS.map((w) => [`word ${w.ar}`, w.emoji] as [string, string | undefined]),
  ...WORLDS.map((w) => [`world ${w.id}`, w.icon] as [string, string]),
  ...BADGES.map((b) => [`badge ${b.id}`, b.icon] as [string, string]),
  ...AVATARS.map((a) => ['avatar', a] as [string, string]),
];
for (const [where, icon] of icons) {
  if (!icon) warn(`${where} has no picture`);
  else if (MODERN_EMOJI.test(icon)) warn(`${where} uses ${icon}, which older devices cannot draw`);
}

console.log(problems === 0 ? '\n✓ content OK\n' : `\n${problems} problem(s)\n`);
process.exit(problems === 0 ? 0 : 1);
