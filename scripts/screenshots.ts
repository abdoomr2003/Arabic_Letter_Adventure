/**
 * README gallery: capture every image in docs/screenshots/ from the real game.
 *
 *   npm run screenshots                  (needs `npm run dev` running)
 *   npm run screenshots -- --url http://localhost:5173 --out docs/screenshots
 *
 * Uses Playwright's bundled Chromium (set PW_CHANNEL=chrome to use Google Chrome).
 * Every frame is a real, played state — the solver drives the game through the
 * DOM exactly like the playtest does.  The one piece of staging is the توت
 * question: the level seed comes from Date.now(), so the clock is pinned to a
 * timestamp whose seed puts توت (ت at the beginning AND the end) first.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { snapshot, step } from './solver';
import { LEVEL_BY_ID, LEVEL_ORDER } from '../src/data/levels';
import { buildLevel } from '../src/game/questions';
import { focusFor } from '../src/game/adaptive';
import type { Progress } from '../src/game/types';

const args = process.argv.slice(2);
const flag = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const URL = flag('--url') ?? 'http://localhost:5173';
const OUT = flag('--out') ?? 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

type Lang = 'ar' | 'en';
const DESKTOP = { width: 1280, height: 860 };
const PHONE = { width: 390, height: 844 };

/* ------------------------------------------------------------------ saves */

function emptyProgress(): Progress {
  return {
    xp: 0, coins: 0, totalScore: 0, levels: {}, mastery: {}, unlockedRewards: [],
    bestCombo: 0, wordsCompleted: 0, lastPlayed: 0,
  };
}

/** A good chunk of the adventure finished, so the map and profile have content. */
function midGame(): Progress {
  const levels: Progress['levels'] = {};
  for (const id of LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf('bellies-2'))) {
    levels[id] = { completed: true, stars: 3, bestScore: 4200, bestAccuracy: 1, bestCombo: 11, plays: 2 } as Progress['levels'][string];
  }
  return {
    ...emptyProgress(),
    xp: 4200, coins: 1840, totalScore: 52000, levels,
    mastery: {
      'ا': { seen: 14, correct: 13, formErrors: 0, similarErrors: 0, wordErrors: 1, avgMs: 900, mastery: 0.93 },
      'ب': { seen: 16, correct: 15, formErrors: 1, similarErrors: 0, wordErrors: 0, avgMs: 850, mastery: 0.94 },
      'ت': { seen: 10, correct: 6, formErrors: 2, similarErrors: 3, wordErrors: 0, avgMs: 1400, mastery: 0.5 },
    } as Progress['mastery'],
    unlockedRewards: ['first-step', 'shape-seer', 'flawless', 'boss-alif'],
    bestCombo: 11, wordsCompleted: 22, lastPlayed: Date.now(),
  };
}

/** Only the first letter level done: the Alif boss is the next thing to play. */
function alifDone(): Progress {
  return {
    ...emptyProgress(),
    xp: 180, coins: 90, totalScore: 3100,
    levels: { 'alif-1': { completed: true, stars: 3, bestScore: 3100, bestAccuracy: 1, bestCombo: 9, plays: 1 } } as Progress['levels'],
  };
}

function saveFile(lang: Lang, progress: Progress, reducedMotion = true) {
  return {
    version: 1,
    settings: { lang, sound: false, reducedMotion, transliteration: true, highContrast: false },
    profile: { name: lang === 'ar' ? 'ليلى' : 'Layla', avatar: '🦊', createdAt: Date.now() },
    progress,
  };
}

/* ---------------------------------------------------------------- browser */

let browser: Browser;

async function open(
  lang: Lang, progress: Progress,
  opts: { size?: { width: number; height: number }; reducedMotion?: boolean; clock?: number } = {},
): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: opts.size ?? DESKTOP,
    locale: lang === 'ar' ? 'ar' : 'en-US',
  });
  const payload = JSON.stringify(saveFile(lang, progress, opts.reducedMotion ?? true));
  await ctx.addInitScript(([s, clock]: [string, number | null]) => {
    (window as unknown as { __name: unknown }).__name = (f: unknown) => f;
    try { localStorage.setItem('arabic-letter-adventure/save', s); } catch { /* ignore */ }
    if (clock !== null) Date.now = () => clock;
  }, [payload, opts.clock ?? null] as [string, number | null]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home__title');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function shot(page: Page, name: string, settle = 450) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 84 });
  console.log(`  ✓ ${name}.jpg`);
}

const nav = (page: Page, i: number) => page.locator('.home__nav .btn').nth(i).click();

async function toMap(page: Page) {
  await nav(page, 0);
  await page.waitForSelector('.map__road');
}

async function toWorld(page: Page, index: number) {
  await toMap(page);
  await page.locator('.map__node:not(.map__node--locked) .map__island').nth(index).click();
  await page.waitForSelector('.world__levels');
}

/** Open the n-th unlocked letter level of a world and wait for its discovery reveal. */
async function openLevel(page: Page, world: number, level: number) {
  await toWorld(page, world);
  await page.locator('.lvl:not(.lvl--locked):not(.lvl--boss) .btn').nth(level).click();
  await page.waitForSelector('.discovery__glyph');
  await page.waitForTimeout(4600); // every shape and example revealed
}

/** Scroll the discovery screen so its shape strip and real-word examples are in frame. */
async function showForms(page: Page) {
  // Scroll only the screen's own scroll area, so the HUD stays in frame.
  await page.locator('.discovery__forms').evaluate((el) => {
    let box = el.parentElement;
    while (box && box.scrollHeight <= box.clientHeight + 1) box = box.parentElement;
    if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
    window.scrollTo(0, 0);
  });
}

/** Let the solver play until `until` is on screen (or the level ends). */
async function playUntil(page: Page, lang: Lang, until: (kind: string) => boolean, max = 60) {
  for (let i = 0; i < max; i++) {
    const s = await snapshot(page);
    if (until(s.kind)) return s.kind;
    if (s.kind === 'result' || s.kind === 'fail') return s.kind;
    await step(page, lang);
    await page.waitForTimeout(250);
  }
  return (await snapshot(page)).kind;
}

/** A clock whose level seed makes توت the first "where is ت?" question of plates-2. */
function clockForToot(progress: Progress): number {
  const level = LEVEL_BY_ID.get('plates-2')!;
  const focus = focusFor(progress, level.targetLetters);
  const base = Date.UTC(2026, 0, 1);
  for (let t = base; t < base + 200000; t++) {
    const seed = (t ^ (level.id.length * 2654435761)) >>> 0;
    const phase = buildLevel(level, seed, focus).find((p) => p.type === 'POSITION_DETECTION');
    if (phase?.questions[0]?.word?.ar === 'تُوت') return t;
  }
  throw new Error('no seed puts توت first');
}

/* ----------------------------------------------------------------- scenes */

async function homes() {
  for (const [lang, name] of [['ar', '01-home-arabic'], ['en', '02-home-english']] as const) {
    const page = await open(lang, midGame());
    await shot(page, name, 900);
    await page.context().close();
  }
}

async function maps() {
  let page = await open('en', emptyProgress());
  await toMap(page);
  await shot(page, '03-world-map');
  await page.context().close();

  page = await open('en', midGame());
  await toMap(page);
  await shot(page, '04-world-map-progress');
  await page.locator('.map__node:not(.map__node--locked) .map__island').nth(2).click();
  await page.waitForSelector('.world__levels');
  await shot(page, '05-world-levels');
  await page.context().close();
}

/** ب discovery → play the whole level → level complete. */
async function baa() {
  const page = await open('en', midGame());
  await openLevel(page, 1, 0);
  await shot(page, '06-discovery-baa');
  const end = await playUntil(page, 'en', (k) => k === 'result');
  if (end !== 'result') throw new Error(`ب level ended in ${end}`);
  await shot(page, '15-level-complete', 1200);
  await page.context().close();
}

/** ا discovery: the أول ← وسط ← آخر strip and أَسَد، بَاب، عَصَا. */
async function alif() {
  for (const [lang, name] of [['en', '07-discovery-alif'], ['ar', '08-discovery-arabic']] as const) {
    const page = await open(lang, midGame());
    await openLevel(page, 0, 0);
    await showForms(page);
    await shot(page, name);
    await page.context().close();
  }
  const phone = await open('ar', midGame(), { size: PHONE });
  await openLevel(phone, 0, 0);
  await showForms(phone);
  await shot(phone, '20-mobile-arabic');
  await phone.context().close();
}

/** Shape Shifter in Arabic: ب placed in the first slot, with its real word. */
async function shifter() {
  const page = await open('ar', midGame());
  await openLevel(page, 1, 0);
  const kind = await playUntil(page, 'ar', (k) => k === 'shifter');
  if (kind !== 'shifter') throw new Error(`never reached the shifter (${kind})`);
  await page.locator('.shifter__slot').first().click(); // the first step asks for أول الكلمة
  await shot(page, '09-shape-shifter-arabic', 700);
  await page.context().close();
}

/** "Where is ت in توت?" — both places picked and checked. */
async function toot() {
  const progress = midGame();
  const page = await open('en', progress, { clock: clockForToot(progress) });
  await openLevel(page, 1, 1);
  for (let i = 0; i < 60; i++) {
    const word = await page.locator('.challenge__word .aword__text').textContent().catch(() => null);
    const isPosition = await page.locator('.optgrid .tile .tile__label--big').count();
    if (word === 'تُوت' && isPosition) break;
    const s = await snapshot(page);
    if (s.kind === 'result' || s.kind === 'fail') throw new Error(`ت level ended in ${s.kind} before توت`);
    await step(page, 'en');
    await page.waitForTimeout(250);
  }
  for (const label of ['Beginning', 'End']) {
    await page.locator('.optgrid .tile', { hasText: label }).click();
    await page.waitForTimeout(150);
  }
  await page.locator('.challenge__foot .btn', { hasText: 'Check' }).click();
  await shot(page, '10-challenge', 300);
  await page.context().close();
}

/** Alif boss: secret letter → duel → 30-second round → three words → champion. */
async function boss() {
  const page = await open('en', alifDone(), { reducedMotion: false });
  await toWorld(page, 0);
  await page.locator('.lvl--boss .btn').click();
  await page.waitForSelector('.duel__grid--choose');
  await shot(page, '11-duel-secret-letter');

  for (let attempt = 0; attempt < 5; attempt++) {
    await step(page, 'en'); // choose the secret
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await step(page, 'en'); await page.waitForTimeout(250); }
    if (attempt === 0) await shot(page, '12-duel');
    const kind = await playUntil(page, 'en', (k) => !['duel', 'duel-choose'].includes(k), 40);
    if (kind !== 'fail') break;
    await page.locator('.fail__actions .btn').first().click(); // the rival won — retry
    await page.waitForSelector('.duel__grid--choose');
  }
  if ((await snapshot(page)).kind === 'duel-won') { await step(page, 'en'); await page.waitForTimeout(500); }

  await page.waitForSelector('.rush__introcard');
  await shot(page, '13-timed-round-intro');
  await step(page, 'en');
  await page.waitForSelector('.rush__choices');
  await shot(page, '14-three-word-challenge', 1200);

  const end = await playUntil(page, 'en', (k) => k === 'result');
  if (end !== 'result') throw new Error(`boss ended in ${end}`);
  await shot(page, '16-boss-complete', 1500);
  await page.context().close();
}

async function menus() {
  const page = await open('en', midGame());
  await nav(page, 1);
  await page.waitForSelector('.profile__card');
  await shot(page, '17-profile');

  await page.goto(URL);
  await page.waitForSelector('.home__nav .btn');
  await nav(page, 2);
  await page.waitForSelector('.howto__steps');
  await shot(page, '18-how-to-play');

  await page.goto(URL);
  await page.waitForSelector('.home__nav .btn');
  await nav(page, 3);
  await page.waitForSelector('.modal');
  await shot(page, '19-settings');
  await page.context().close();

  const phone = await open('en', midGame(), { size: PHONE });
  await toMap(phone);
  await shot(phone, '21-mobile-english');
  await phone.context().close();
}

async function main() {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const only = flag('--only');
  const scenes = { homes, maps, baa, alif, shifter, toot, boss, menus };
  for (const [name, run] of Object.entries(scenes)) {
    if (only && !only.split(',').includes(name)) continue;
    console.log(name);
    await run();
  }
  await browser.close();
}

main().catch(async (e) => { console.error(e); await browser?.close(); process.exit(1); });
