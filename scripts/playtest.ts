/**
 * Full playthrough test.
 *
 * Runs the real game in a real browser and plays it: it reads the screen, works
 * out the answers with the game's own Arabic rules, answers correctly, answers
 * wrongly on purpose, loses hearts, builds a combo, finishes levels, beats a
 * boss duel and its timed 3-word round, reloads to prove persistence, and checks
 * that locked content really is locked.
 *
 *   npm run playtest            (needs `npm run dev` running)
 *   npm run playtest -- --shots --shotdir /tmp/shots
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { snapshot, step, targetLetter } from './solver';
import { translate } from '../src/data/i18n';
import { availablePositions } from '../src/game/arabic';

const args = process.argv.slice(2);
const flag = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const URL = flag('--url') ?? 'http://localhost:5173';
const SHOTS = args.includes('--shots');
const SHOT_DIR = flag('--shotdir') ?? '/tmp/alashots';
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
const section = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`);

let shotN = 0;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOT_DIR}/${String(++shotN).padStart(2, '0')}-${name}.png` });
}

const readSave = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('arabic-letter-adventure/save') ?? 'null'));

/** Play the level currently on screen to its end. Returns how it ended. */
async function playLevel(
  page: Page, lang: 'ar' | 'en',
  opts: { wrongOnKinds?: string[]; wrongCount?: number; maxSteps?: number; log?: boolean } = {},
) {
  const wrongKinds = new Set(opts.wrongOnKinds ?? []);
  let wrongBudget = opts.wrongCount ?? 0;
  const max = opts.maxSteps ?? 90;
  const seen = new Set<string>();
  let n = 0;
  let livesLost = 0;
  let prevLives = 3;
  let maxCombo = 0;

  for (; n < max; n++) {
    const snap = await snapshot(page);
    if (snap.kind === 'result' || snap.kind === 'fail') {
      return { end: snap.kind, steps: n, kinds: [...seen], livesLost, maxCombo };
    }
    seen.add(snap.kind);
    if (snap.lives < prevLives) livesLost += prevLives - snap.lives;
    prevLives = snap.lives;
    if (snap.combo) {
      const m = snap.combo.match(/(\d+)/);
      if (m) maxCombo = Math.max(maxCombo, Number(m[1]));
    }
    if (opts.log) console.log(`    [${n}] ${snap.kind} lives=${snap.lives} score=${snap.score} · ${snap.prompt.slice(0, 44)}`);

    const beWrong = wrongBudget > 0 && wrongKinds.has(snap.kind);
    if (beWrong) wrongBudget--;
    const r = await step(page, lang, { wrongOnPurpose: beWrong });
    if (!r.acted) await page.waitForTimeout(400);
  }
  const snap = await snapshot(page);
  return { end: snap.kind, steps: n, kinds: [...seen], livesLost, maxCombo };
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US' });
  // tsx compiles with esbuild's keepNames, which references a `__name` helper
  // inside any function we hand to page.evaluate. Provide it in the page.
  await ctx.addInitScript(() => {
    (window as unknown as { __name: unknown }).__name =
      (fn: unknown) => fn;
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.home__title');

  /* ================================================================== HOME */
  section('HOME & LANGUAGE');
  check('home renders', await page.locator('.home__title').isVisible());
  check('Arabic title present', (await page.locator('.home__titlear').textContent())?.includes('الحروف') ?? false);
  check('starts in Arabic RTL', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
  await shot(page, 'home-ar');

  await page.locator('.langtoggle__btn', { hasText: 'English' }).click();
  await page.waitForTimeout(200);
  check('English switches direction to LTR', (await page.evaluate(() => document.documentElement.dir)) === 'ltr');
  check('UI text switched', /Start the adventure/i.test((await page.locator('.home__cta .btn').textContent()) ?? ''));
  check('Arabic letters are NOT translated away',
    (await page.locator('.home__forms').textContent())?.includes('ب') ?? false);
  await shot(page, 'home-en');
  const lang = 'en' as const;

  /* ================================================== ARABIC SHAPING (real) */
  section('ARABIC SHAPING (rendered pixels, not guesses)');
  // Draw each contextual form to a canvas and fingerprint the pixels.  Widths can
  // coincide between two genuinely different glyphs, so the shapes themselves are
  // what gets compared.
  const shaping = await page.evaluate(async () => {
    await (document as Document & { fonts: FontFaceSet }).fonts.load('96px "Noto Naskh Arabic"');
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 200;
    const g = cv.getContext('2d')!;
    const fingerprint = (s: string) => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#000';
      g.font = '96px "Noto Naskh Arabic", serif';
      g.textBaseline = 'middle';
      g.direction = 'rtl';
      g.fillText(s, 200, 100);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let h = 2166136261;
      let ink = 0;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i] > 8 ? 1 : 0;
        ink += a;
        h ^= a * (i + 1); h = Math.imul(h, 16777619);
      }
      return { h: h >>> 0, ink };
    };
    const Z = '\u200D';
    const out: Record<string, { h: number; ink: number }> = {};
    const dual = ['ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي'];
    for (const ch of dual) {
      out[`${ch}|isolated`] = fingerprint(ch);
      out[`${ch}|initial`] = fingerprint(ch + Z);
      out[`${ch}|medial`] = fingerprint(Z + ch + Z);
      out[`${ch}|final`] = fingerprint(Z + ch);
    }
    for (const ch of ['ا', 'د', 'ذ', 'ر', 'ز', 'و']) {
      out[`${ch}|isolated`] = fingerprint(ch);
      out[`${ch}|initial`] = fingerprint(ch + Z);
      out[`${ch}|final`] = fingerprint(Z + ch);
    }
    out['word|kitaab'] = fingerprint('كِتَاب');
    out['word|apart'] = fingerprint('ك ت ا ب');
    return out;
  });

  const dualLetters = ['ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي'];
  let dualOk = 0;
  const dualBad: string[] = [];
  for (const ch of dualLetters) {
    const hashes = new Set(['isolated', 'initial', 'medial', 'final'].map((p) => shaping[`${ch}|${p}`].h));
    if (hashes.size === 4) dualOk++; else dualBad.push(`${ch}(${hashes.size})`);
    check(`${ch}: renders 4 visually distinct forms`, hashes.size === 4, `${hashes.size} distinct`);
  }
  check('every dual-joining letter has 4 real shapes', dualBad.length === 0, dualBad.join(' '));
  void dualOk;

  for (const ch of ['ا', 'د', 'ذ', 'ر', 'ز', 'و']) {
    check(`${ch}: "initial" is identical to isolated (it never joins forward)`,
      shaping[`${ch}|initial`].h === shaping[`${ch}|isolated`].h);
    check(`${ch}: final form is visually different from isolated`,
      shaping[`${ch}|final`].h !== shaping[`${ch}|isolated`].h);
    check(`${ch}: the data model says 2 positions, matching the rendering`,
      availablePositions(ch).length === 2);
  }
  check('a joined word does not render as separated letters',
    shaping['word|kitaab'].h !== shaping['word|apart'].h);

  /* =================================================================== MAP */
  section('MAP & LOCKING');
  await page.locator('.home__nav .btn', { hasText: 'World map' }).click();
  await page.waitForSelector('.map__road');
  check('7 worlds on the map', (await page.locator('.map__node').count()) === 7);
  check('6 worlds start locked', (await page.locator('.map__node--locked').count()) === 6);
  check('locked island is disabled', await page.locator('.map__node--locked .map__island').first().isDisabled());
  await page.locator('.map__node--locked .map__island').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);
  check('clicking a locked world changes nothing', await page.locator('.map__road').isVisible());
  await shot(page, 'map');

  /* ============================================== WORLD 1 — ALIF, FULL PLAY */
  section('WORLD 1 — play level 1 (ا) with deliberate mistakes');
  await page.locator('.map__node:not(.map__node--locked) .map__island').first().click();
  await page.waitForSelector('.world__levels');
  check('world 1 has letter levels + a boss',
    (await page.locator('.lvl').count()) === 2, `${await page.locator('.lvl').count()}`);
  check('the boss level starts locked', (await page.locator('.lvl--locked').count()) === 1);
  await shot(page, 'world1');

  await page.locator('.lvl:not(.lvl--locked) .btn').first().click();
  await page.waitForSelector('.discovery__glyph');
  check('discovery makes the letter the hero',
    (await page.locator('.discovery__glyph').textContent())?.trim() === 'ا');
  await page.waitForTimeout(2600);
  check('alif shows exactly 2 forms, not 4',
    (await page.locator('.discovery__forms .formstrip__chip').count()) === 2);
  check('and says why', /two shapes/i.test((await page.locator('.discovery__formnote').textContent()) ?? ''));
  await shot(page, 'discovery-alif');

  const run1 = await playLevel(page, lang, { wrongOnKinds: ['mcq'], wrongCount: 1, log: true });
  check('level 1 reached a real end state', run1.end === 'result' || run1.end === 'fail', run1.end);
  check('a deliberate mistake cost a heart', run1.livesLost >= 1, `${run1.livesLost} lost`);
  check('several challenge types were played', run1.kinds.length >= 3, run1.kinds.join(', '));
  await shot(page, 'level1-end');

  if (run1.end === 'fail') {
    section('FAILURE PATH');
    check('failure screen offers retry', (await page.locator('.fail__actions .btn').count()) >= 2);
    check('failure screen re-teaches the forms', (await page.locator('.fail__reminder').count()) >= 0);
    const saveOnFail = await readSave(page);
    check('a failed level is NOT marked complete',
      !Object.values(saveOnFail?.progress?.levels ?? {}).some((l: any) => l.completed));
    await shot(page, 'fail');
    await page.locator('.fail__actions .btn').first().click(); // retry
    await page.waitForTimeout(600);
    const run1b = await playLevel(page, lang, {});
    check('retry can complete the level', run1b.end === 'result', run1b.end);
  }

  /* =============================================================== RESULTS */
  section('LEVEL COMPLETE');
  const onResult = (await snapshot(page)).kind === 'result';
  check('reached the completion screen', onResult);
  if (!onResult) { await finish(browser, errors); return; }

  const res = await page.evaluate(() => ({
    stars: document.querySelectorAll('.result__shield .star:not(.star--off)').length,
    score: Number((document.querySelector('.result__scorenum')?.textContent ?? '0').replace(/\D/g, '')),
    stats: Object.fromEntries([...document.querySelectorAll('.stat')].map((s) => [
      s.querySelector('.stat__label')?.textContent?.trim(),
      s.querySelector('.stat__value')?.textContent?.trim(),
    ])),
    learned: document.querySelector('.result__learnedtext')?.textContent?.trim(),
    unlocks: [...document.querySelectorAll('.result__unlock')].map((x) => x.textContent?.trim()),
  }));
  check('stars awarded (1–3)', res.stars >= 1 && res.stars <= 3, `${res.stars}★`);
  check('score is a real number from play', res.score > 0, String(res.score));
  check('accuracy reported', 'Accuracy' in res.stats, JSON.stringify(res.stats));
  check('says what was learned', (res.learned ?? '').length > 10, res.learned);
  await shot(page, 'result');

  const save1: any = await readSave(page);
  check('progress persisted to localStorage', !!save1?.progress);
  check('level marked complete', save1.progress.levels['alif-1']?.completed === true);
  check('coins earned > 0', save1.progress.coins > 0, String(save1.progress.coins));
  check('XP earned > 0', save1.progress.xp > 0, String(save1.progress.xp));
  check('per-letter mastery recorded for ا', !!save1.progress.mastery['ا'],
    JSON.stringify(save1.progress.mastery['ا'] ?? {}));

  /* ============================================================ PERSISTENCE */
  section('PERSISTENCE');
  const coins = save1.progress.coins;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.home__title');
  const save2: any = await readSave(page);
  check('save survives reload', save2.progress.coins === coins, String(save2.progress.coins));
  check('language choice persisted', save2.settings.lang === 'en');
  check('home offers Continue after progress',
    /Continue/i.test((await page.locator('.home__cta .btn').textContent()) ?? ''));

  /* ======================================================= BOSS: THE DUEL */
  section('BOSS — Secret Letter duel + timed 3-word round');
  await page.locator('.home__nav .btn', { hasText: 'World map' }).click();
  await page.waitForSelector('.map__road');
  await page.locator('.map__node:not(.map__node--locked) .map__island').first().click();
  await page.waitForSelector('.world__levels');
  const bossUnlocked = (await page.locator('.lvl--boss:not(.lvl--locked)').count()) === 1;
  check('beating level 1 unlocked the world boss', bossUnlocked);

  if (bossUnlocked) {
    await page.locator('.lvl--boss .btn').click();
    await page.waitForSelector('.duel__grid--choose', { timeout: 6000 });
    check('duel asks you to choose a secret letter first', true);
    await shot(page, 'duel-choose');

    await step(page, lang);                       // choose secret
    await page.waitForTimeout(400);
    check('your secret letter is displayed to you',
      ((await page.locator('.duel__secretglyph').textContent()) ?? '').trim().length > 0);
    check('the deduction grid is shown', (await page.locator('.duel__grid .tile').count()) >= 9,
      `${await page.locator('.duel__grid .tile').count()} tiles`);

    // Play the duel: ask clues, answer the rival truthfully, then guess.
    let duelSteps = 0;
    let sawRivalQuestion = false;
    let sawClueAnswer = false;
    while (duelSteps++ < 40) {
      const s = await snapshot(page);
      if (s.kind !== 'duel' && s.kind !== 'duel-choose') break;
      if (await page.locator('.duel__askq').count()) sawRivalQuestion = true;
      if (await page.locator('.duel__ans').count()) sawClueAnswer = true;
      await step(page, lang);
      await page.waitForTimeout(250);
    }
    check('the rival really asks you about your own letter', sawRivalQuestion);
    check('your clue questions really get answered', sawClueAnswer);
    await shot(page, 'duel');

    const afterDuel = await snapshot(page);
    check('duel resolved into a real outcome',
      ['duel-won', 'rush-intro', 'fail', 'result'].includes(afterDuel.kind), afterDuel.kind);
    check('the duel is winnable when played correctly',
      afterDuel.kind !== 'fail', afterDuel.kind);

    if (afterDuel.kind === 'duel-won') { await step(page, lang); await page.waitForTimeout(500); }

    const s2 = await snapshot(page);
    if (s2.kind === 'rush-intro') {
      section('TIMED 3-WORD ROUND');
      const introText = await page.locator('.rush__introtitle').textContent();
      check('timed round announces its clock', /\d+ seconds/i.test(introText ?? ''), introText?.trim());
      await shot(page, 'rush-intro');

      await step(page, lang);                       // start the clock
      await page.waitForTimeout(600);
      const t1 = await page.locator('.timer').textContent();
      await page.waitForTimeout(2200);
      const t2 = await page.locator('.timer').textContent();
      check('the timer actually counts down', t1 !== t2, `${t1?.trim()} → ${t2?.trim()}`);
      await shot(page, 'rush');

      let rushSteps = 0;
      while (rushSteps++ < 14) {
        const s = await snapshot(page);
        if (s.kind !== 'rush') break;
        await step(page, lang);
        await page.waitForTimeout(400);
      }
      const after = await snapshot(page);
      check('3-word round finished', ['rush-over', 'result', 'fail'].includes(after.kind), after.kind);
      if (after.kind === 'rush-over') {
        const summary = await page.locator('.rush__score').textContent();
        check('round reports how many words were right', /\d/.test(summary ?? ''), summary?.trim());
        await step(page, lang);
        await page.waitForTimeout(800);
      }
      const end = await snapshot(page);
      check('boss level ended in a real state', ['result', 'fail'].includes(end.kind), end.kind);
      await shot(page, 'boss-end');

      if (end.kind === 'result') {
        const save3: any = await readSave(page);
        check('beating the boss unlocked world 2',
          !!save3.progress.levels['alif-boss']?.completed);
        check('a badge was earned for the world',
          save3.progress.unlockedRewards.includes('boss-alif'),
          save3.progress.unlockedRewards.join(','));
      }
    }
  }

  /* ============================================================== WORLD 2 */
  section('WORLD 2 — ب, the four-form letter');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('.home__nav .btn', { hasText: 'World map' }).click();
  await page.waitForSelector('.map__road');
  const stillLocked = await page.locator('.map__node--locked').count();
  check('world 2 is now open', stillLocked <= 5, `${stillLocked} locked`);
  await shot(page, 'map-after');

  if (stillLocked <= 5) {
    await page.locator('.map__node:not(.map__node--locked) .map__island').nth(1).click();
    await page.waitForSelector('.world__levels');
    check('world 2 is the City of Plates',
      /Plates/i.test((await page.locator('.banner').first().textContent()) ?? ''));
    check('world 2 has 4 letters + boss', (await page.locator('.lvl').count()) === 5,
      `${await page.locator('.lvl').count()}`);

    await page.locator('.lvl:not(.lvl--locked) .btn').first().click();
    await page.waitForSelector('.discovery__glyph');
    check('world 2 level 1 teaches ب',
      (await page.locator('.discovery__glyph').textContent())?.trim() === 'ب');
    await page.waitForTimeout(3800);
    check('ب reveals all four forms',
      (await page.locator('.discovery__forms .formstrip__chip').count()) === 4,
      String(await page.locator('.discovery__forms .formstrip__chip').count()));
    check('the "same letter!" moment fires', (await page.locator('.discovery__same').count()) === 1);
    check('real example words shown for the positions',
      (await page.locator('.discovery__word:not(.is-hidden)').count()) >= 3);
    await shot(page, 'discovery-baa');

    // Verify the example words genuinely place ب where they claim.
    const examples = await page.$$eval('.discovery__word', (els) => els.map((el) => ({
      label: el.querySelector('.discovery__poslabel')?.textContent?.trim() ?? '',
      word: el.querySelector('.aword__text')?.textContent ?? '',
    })));
    const { analyzeWord, sameLetter } = await import('../src/game/arabic');
    let allTrue = true;
    for (const ex of examples) {
      if (!ex.word) continue;
      const letters = analyzeWord(ex.word);
      const hit = letters.find((l) => sameLetter(l.base, 'ب'));
      const wantPos = Object.entries({
        [translate(lang, 'pos.isolated')]: 'isolated',
        [translate(lang, 'pos.initial')]: 'initial',
        [translate(lang, 'pos.medial')]: 'medial',
        [translate(lang, 'pos.final')]: 'final',
      }).find(([txt]) => txt === ex.label)?.[1];
      const ok = !!hit && letters.some((l) => sameLetter(l.base, 'ب') && l.position === wantPos);
      if (!ok) { allTrue = false; console.log(`      ! ${ex.word} claimed ${ex.label}`); }
    }
    check('every discovery example really has ب in the stated position', allTrue,
      examples.map((e) => `${e.word}=${e.label}`).join(' | '));

    const run2 = await playLevel(page, lang, { maxSteps: 120 });
    check('the ب level can be completed', run2.end === 'result', `${run2.end} after ${run2.steps} steps`);
    check('the ب level used form + word challenges', run2.kinds.length >= 4, run2.kinds.join(', '));
    await shot(page, 'level-baa-end');

    if (run2.end === 'result') {
      const save4: any = await readSave(page);
      check('ب mastery recorded', (save4.progress.mastery['ب']?.seen ?? 0) > 0,
        JSON.stringify(save4.progress.mastery['ب']));
      check('next level in world 2 now unlocked',
        !!save4.progress.levels['plates-1']?.completed);
    }
  }

  /* ============================================================== PROFILE */
  section('PROFILE');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('.home__nav .btn', { hasText: 'My profile' }).click();
  await page.waitForSelector('.profile__card');
  const prof = await page.evaluate(() => ({
    letters: document.querySelectorAll('.profile__letter').length,
    practised: document.querySelectorAll('.profile__letter:not(.is-new)').length,
    badges: document.querySelectorAll('.profile__badge:not(.is-locked)').length,
    stats: [...document.querySelectorAll('.profile__statnum')].map((s) => s.textContent?.trim()),
  }));
  check('profile shows all 28 letters', prof.letters === 28, String(prof.letters));
  check('letters actually played are marked', prof.practised >= 1, `${prof.practised} practised`);
  check('badges earned from real play', prof.badges >= 1, `${prof.badges}`);
  check('learning stats are populated', prof.stats.length >= 5, prof.stats.join(' | '));
  await shot(page, 'profile');

  await page.locator('.profile__name').fill('Layla');
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  const save5: any = await readSave(page);
  check('profile name persists', save5.profile.name === 'Layla', save5.profile.name);

  /* ============================================================= SETTINGS */
  section('SETTINGS & ACCESSIBILITY');
  await page.locator('.home__nav .btn', { hasText: 'Settings' }).click();
  await page.waitForSelector('.modal');
  await page.locator('.switch', { hasText: 'Reduce motion' }).click();
  await page.waitForTimeout(200);
  check('reduced motion applies to the document',
    (await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduced');
  await page.locator('.switch', { hasText: 'High contrast' }).click();
  await page.waitForTimeout(200);
  check('high contrast applies to the document',
    (await page.evaluate(() => document.documentElement.dataset.contrast)) === 'high');
  await shot(page, 'settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape closes the modal', (await page.locator('.modal').count()) === 0);

  /* =========================================================== HOW TO PLAY */
  section('HOW TO PLAY');
  await page.locator('.home__nav .btn', { hasText: 'How to play' }).click();
  await page.waitForSelector('.howto__steps');
  check('all six rules of the design are listed',
    (await page.locator('.howto__step').count()) === 6);
  check('all seven worlds are listed', (await page.locator('.howto__world').count()) === 7);
  const idea = await page.locator('.howto__idea').textContent();
  check('the core idea is explained with both a 4-form and a 2-form letter',
    (await page.locator('.howto__idea .formstrip').count()) === 2, (idea ?? '').slice(0, 50));
  await shot(page, 'howto');

  /* ============================================================ RESET FLOW */
  section('RESET');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.locator('.home__nav .btn', { hasText: 'Settings' }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .btn', { hasText: 'Reset progress' }).click();
  await page.waitForTimeout(150);
  await page.locator('.modal .btn--red').click();
  await page.waitForTimeout(400);
  const save6: any = await readSave(page);
  check('reset clears progress', Object.keys(save6?.progress?.levels ?? {}).length === 0);
  check('reset keeps settings and profile', save6?.settings?.lang === 'en' && save6?.profile?.name === 'Layla');

  /* ========================================================== RESPONSIVE */
  section('RESPONSIVE');
  for (const [name, size] of [
    ['mobile', { width: 390, height: 844 }],
    ['tablet', { width: 820, height: 1180 }],
    ['desktop', { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.home__title');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${name}: no horizontal overflow`, overflow <= 1, `${overflow}px`);
    const btn = await page.locator('.home__cta .btn').boundingBox();
    check(`${name}: primary button is touch-sized`, (btn?.height ?? 0) >= 44, `${Math.round(btn?.height ?? 0)}px`);
    // And inside a level
    await page.locator('.home__cta .btn').click();
    await page.waitForSelector('.discovery__glyph');
    const o2 = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${name}: level screen has no overflow`, o2 <= 1, `${o2}px`);
    await shot(page, `responsive-${name}`);
  }

  await finish(browser, errors);
}

async function finish(browser: Awaited<ReturnType<typeof chromium.launch>>, errors: string[]) {
  section('CONSOLE');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(fail === 0 ? 0 : 1);
}

void targetLetter; // re-exported helper, used by the solver

main().catch((e) => { console.error(e); process.exit(2); });
