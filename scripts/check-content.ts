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

console.log(problems === 0 ? '\n✓ content OK\n' : `\n${problems} problem(s)\n`);
process.exit(problems === 0 ? 0 : 1);
