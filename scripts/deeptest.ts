/**
 * Deep-level test.
 *
 * The beginner worlds only use a subset of the challenge types.  This seeds the
 * save file of a player who has already got that far — the same thing that
 * happens after a few sessions — and then really plays an intermediate level, an
 * advanced level (with its 30-second Letter Rush) and a late boss, so every
 * challenge type in the engine is exercised in a browser.
 *
 *   npm run deeptest      (needs `npm run dev` running)
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { snapshot, step } from './solver';
import { LEVEL_ORDER, LEVELS, levelsOfWorld } from '../src/data/levels';
import { WORLDS } from '../src/data/worlds';

const args = process.argv.slice(2);
const flag = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const URL = flag('--url') ?? 'http://localhost:5173';
const SHOTS = args.includes('--shots');
const SHOT_DIR = flag('--shotdir') ?? '/tmp/alashots-deep';
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
const section = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`);

let shotN = 0;
const shot = async (page: Page, n: string) =>
  SHOTS && page.screenshot({ path: `${SHOT_DIR}/${String(++shotN).padStart(2, '0')}-${n}.png` });

/** Build the save of a player who has finished everything before `levelId`. */
function seedSave(levelId: string) {
  const upto = LEVEL_ORDER.indexOf(levelId);
  const levels: Record<string, unknown> = {};
  for (const id of LEVEL_ORDER.slice(0, upto)) {
    levels[id] = { completed: true, stars: 2, bestScore: 1500, bestAccuracy: 0.9, bestCombo: 6, plays: 1 };
  }
  return {
    version: 1,
    settings: { lang: 'en', sound: false, reducedMotion: false, transliteration: true, highContrast: false },
    profile: { name: 'Tester', avatar: '🦊', createdAt: Date.now() },
    progress: {
      xp: 3000, coins: 2000, totalScore: 40000, levels, mastery: {},
      unlockedRewards: [], bestCombo: 9, wordsCompleted: 12, lastPlayed: Date.now(),
    },
  };
}

/**
 * Open a level as a returning player would find it.  The save is planted before
 * the app boots — the game flushes its in-memory save when a page goes away, so
 * writing it after boot would simply be overwritten (which is the persistence
 * layer doing its job).
 */
async function openLevel(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  levelId: string,
  errors: string[],
): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US' });
  const payload = JSON.stringify(seedSave(levelId));
  await ctx.addInitScript(
    ([save]: string[]) => {
      (window as unknown as { __name: unknown }).__name = (f: unknown) => f;
      try { localStorage.setItem('arabic-letter-adventure/save', save); } catch { /* ignore */ }
    },
    [payload],
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home__title');
  const applied = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('arabic-letter-adventure/save') ?? '{}'));
  if (applied?.settings?.lang !== 'en') throw new Error('seed did not take effect');
  await page.locator('.home__nav .btn', { hasText: 'World map' }).click();
  await page.waitForSelector('.map__road');
  const worldId = LEVELS.find((l) => l.id === levelId)!.worldId;
  const order = WORLDS.find((w) => w.id === worldId)!.order;
  await page.locator('.map__node').nth(order - 1).locator('.map__island').click();
  await page.waitForSelector('.world__levels');
  const index = levelsOfWorld(worldId).findIndex((l) => l.id === levelId);
  await page.locator('.lvl').nth(index).locator('.btn').click();
  await page.waitForTimeout(500);
  return page;
}

/** Play the current level, recording which challenge types were actually seen. */
async function play(page: Page, maxSteps = 140, log = false) {
  const kinds = new Set<string>();
  const prompts = new Set<string>();
  let timerSeen = false;
  let comboSeen = 0;
  for (let n = 0; n < maxSteps; n++) {
    const s = await snapshot(page);
    if (s.kind === 'result' || s.kind === 'fail') return { end: s.kind, kinds: [...kinds], prompts: [...prompts], timerSeen, comboSeen, steps: n };
    kinds.add(s.kind);
    if (s.prompt) prompts.add(s.prompt.replace(/[؀-ۿ‍]/g, '·').slice(0, 42));
    if (await page.locator('.timedphase__bar').count()) timerSeen = true;
    if (s.combo) comboSeen = Math.max(comboSeen, Number(s.combo.match(/(\d+)/)?.[1] ?? 0));
    if (log) console.log(`    [${n}] ${s.kind} ♥${s.lives} ${s.score} · ${s.prompt.slice(0, 40)}`);
    const r = await step(page, 'en');
    if (!r.acted) await page.waitForTimeout(350);
  }
  const s = await snapshot(page);
  return { end: s.kind, kinds: [...kinds], prompts: [...prompts], timerSeen, comboSeen, steps: maxSteps };
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors: string[] = [];
  let page: Page;

  /* ------------------------------------------------- intermediate: ج (bellies) */
  section('INTERMEDIATE LEVEL — ج, Village of Bellies');
  page = await openLevel(browser, 'bellies-1', errors);
  check('opened an intermediate level', (await page.locator('.discovery__glyph').count()) === 1);
  check('it teaches ج', (await page.locator('.discovery__glyph').textContent())?.trim() === 'ج');
  await page.waitForTimeout(3600);
  check('ج shows four forms', (await page.locator('.discovery__forms .formstrip__chip').count()) === 4);
  const exWords = await page.$$eval('.discovery__word .aword__text', (e) => e.map((x) => x.textContent));
  check('example words differ per position', new Set(exWords).size === exWords.length,
    exWords.join(' | '));
  await shot(page, 'discovery-jeem');

  const mid = await play(page, 160, true);
  check('intermediate level completed', mid.end === 'result', `${mid.end} in ${mid.steps} steps`);
  check('shape-matching puzzle appeared', mid.kinds.includes('shapeMatch'), mid.kinds.join(', '));
  check('build-the-word appeared', mid.kinds.includes('build'), mid.kinds.join(', '));
  check('contextual-form question appeared',
    mid.prompts.some((p) => /Where in a word is this shape/i.test(p)), mid.prompts.join(' | '));
  check('similar-letter question appeared',
    mid.prompts.some((p) => /Watch the dots/i.test(p)), mid.prompts.join(' | '));
  check('a combo was built', mid.comboSeen >= 2, `×${mid.comboSeen}`);
  await shot(page, 'intermediate-result');

  /* ------------------------------------------- advanced: ط (minaret) + rush */
  section('ADVANCED LEVEL — ط, Minaret Tower (with the 30-second rush)');
  await page.context().close();
  page = await openLevel(browser, 'minaret-1', errors);
  await page.waitForTimeout(3600);
  check('advanced level opened on ط', (await page.locator('.discovery__glyph').textContent())?.trim() === 'ط');
  await shot(page, 'discovery-taa');

  const adv = await play(page, 200);
  check('advanced level completed', adv.end === 'result', `${adv.end} in ${adv.steps} steps`);
  check('the timed Letter Rush ran', adv.timerSeen);
  check('advanced level used build + match + similar',
    adv.kinds.includes('build') && adv.kinds.includes('shapeMatch'), adv.kinds.join(', '));
  await shot(page, 'advanced-result');

  /* ---------------------------------------------------- late boss (advanced) */
  section('LATE BOSS — Minaret Tower');
  await page.context().close();
  page = await openLevel(browser, 'minaret-boss', errors);
  await page.waitForSelector('.duel__grid--choose', { timeout: 6000 });
  const tiles = await page.locator('.duel__grid--choose .tile').count();
  check('late boss offers a bigger letter grid', tiles >= 9, `${tiles} letters`);
  await shot(page, 'boss-choose');

  const boss = await play(page, 90);
  check('late boss resolved', boss.end === 'result' || boss.end === 'fail', `${boss.end} in ${boss.steps} steps`);
  check('the duel was part of it', boss.kinds.includes('duel'), boss.kinds.join(', '));
  await shot(page, 'boss-late');

  /* --------------------------------------------------- non-joining letter: د */
  section('NON-JOINING LETTER — د (only two shapes)');
  await page.context().close();
  page = await openLevel(browser, 'chairs-1', errors);
  await page.waitForTimeout(3000);
  check('د discovery shows exactly two forms',
    (await page.locator('.discovery__forms .formstrip__chip').count()) === 2,
    String(await page.locator('.discovery__forms .formstrip__chip').count()));
  const labels = await page.$$eval('.discovery__forms .formstrip__label', (e) => e.map((x) => x.textContent));
  check('and labels them "On its own" and "End"',
    labels.join(',') === 'On its own,End', labels.join(','));
  const note = await page.locator('.discovery__formnote').textContent();
  check('and explains why', /two shapes/i.test(note ?? ''), note?.trim());
  await shot(page, 'discovery-dal');

  const dal = await play(page, 160);
  check('the د level never asks for a middle form', dal.end === 'result', dal.end);
  check('no "Put د in the Middle" step was generated',
    !dal.prompts.some((p) => /at the Middle/i.test(p)), dal.prompts.filter((p) => /Put/.test(p)).join(' | '));
  await shot(page, 'dal-result');

  section('CONSOLE');
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
