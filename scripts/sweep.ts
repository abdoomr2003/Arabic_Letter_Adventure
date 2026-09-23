/**
 * Visual sweep: capture every screen, in both languages, at three viewports, and
 * report any layout that overflows horizontally or clips its own content.
 *
 *   npm run sweep -- --shotdir /tmp/sweep      (needs `npm run dev`)
 */
import { chromium, type Page, type Browser } from 'playwright';
import { mkdirSync } from 'node:fs';
import { snapshot, step } from './solver';
import { LEVEL_ORDER } from '../src/data/levels';

const args = process.argv.slice(2);
const flag = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const URL = flag('--url') ?? 'http://localhost:5173';
const DIR = flag('--shotdir') ?? '/tmp/sweep';
mkdirSync(DIR, { recursive: true });

let problems = 0;
const note = (ok: boolean, msg: string) => {
  if (!ok) problems++;
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
};

const VIEWS = [
  { name: 'desktop', size: { width: 1366, height: 860 } },
  { name: 'tablet', size: { width: 834, height: 1112 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
] as const;

/** A save with a good chunk of the adventure finished, so every screen has content. */
function seed(lang: 'ar' | 'en') {
  const upto = LEVEL_ORDER.indexOf('bellies-2');
  const levels: Record<string, unknown> = {};
  for (const id of LEVEL_ORDER.slice(0, upto)) {
    levels[id] = { completed: true, stars: 3, bestScore: 4200, bestAccuracy: 1, bestCombo: 11, plays: 2 };
  }
  return JSON.stringify({
    version: 1,
    settings: { lang, sound: false, reducedMotion: true, transliteration: true, highContrast: false },
    profile: { name: lang === 'ar' ? 'ليلى' : 'Layla', avatar: '🦊', createdAt: Date.now() },
    progress: {
      xp: 4200, coins: 1840, totalScore: 52000, levels, mastery: {
        'ا': { seen: 14, correct: 13, formErrors: 0, similarErrors: 0, wordErrors: 1, avgMs: 900, mastery: 0.93 },
        'ب': { seen: 16, correct: 15, formErrors: 1, similarErrors: 0, wordErrors: 0, avgMs: 850, mastery: 0.94 },
        'ت': { seen: 10, correct: 6, formErrors: 2, similarErrors: 3, wordErrors: 0, avgMs: 1400, mastery: 0.5 },
      },
      unlockedRewards: ['first-step', 'shape-seer', 'flawless', 'boss-alif'],
      bestCombo: 11, wordsCompleted: 22, lastPlayed: Date.now(),
    },
  });
}

async function newPage(browser: Browser, lang: 'ar' | 'en', size: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport: size, locale: lang === 'ar' ? 'ar' : 'en-US' });
  const payload = seed(lang);
  await ctx.addInitScript(([s]: string[]) => {
    (window as unknown as { __name: unknown }).__name = (f: unknown) => f;
    try { localStorage.setItem('arabic-letter-adventure/save', s); } catch { /* ignore */ }
  }, [payload]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home__title');
  return page;
}

/** Horizontal overflow, plus anything sticking out of the viewport. */
async function layoutIssues(page: Page) {
  return page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - docW;
    const out: string[] = [];
    document.querySelectorAll('button, .tile, .btn, .panel, .banner, .pill').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.right > docW + 1 || r.left < -1) {
        out.push(`${el.className.toString().split(' ')[0]} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    });
    return { overflow, out: out.slice(0, 5) };
  });
}

/** Back to the home screen, waiting until its nav is really there. */
async function goHome(page: Page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.home__nav .btn', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(150);
}

async function capture(page: Page, tag: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${DIR}/${tag}.png`, fullPage: false });
  const { overflow, out } = await layoutIssues(page);
  note(overflow <= 1 && out.length === 0, `${tag}: overflow ${overflow}px ${out.join(', ')}`);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });

  for (const lang of ['ar', 'en'] as const) {
    for (const view of VIEWS) {
      const tagBase = `${lang}-${view.name}`;
      const page = await newPage(browser, lang, view.size);

      await capture(page, `${tagBase}-01-home`);

      await page.locator('.home__nav .btn').first().click();
      await page.waitForSelector('.map__road');
      await capture(page, `${tagBase}-02-map`);

      await page.locator('.map__node:not(.map__node--locked) .map__island').nth(2).click();
      await page.waitForSelector('.world__levels');
      await capture(page, `${tagBase}-03-world`);

      await page.locator('.lvl:not(.lvl--locked) .btn').first().click();
      await page.waitForSelector('.discovery__glyph');
      await page.waitForTimeout(4200);
      await capture(page, `${tagBase}-04-discovery`);

      // Walk a few challenges so their layouts get captured too.
      await step(page, lang);
      for (let i = 0; i < 12; i++) {
        const s = await snapshot(page);
        if (s.kind === 'result' || s.kind === 'fail') break;
        if (i === 1) await capture(page, `${tagBase}-05-${s.kind}`);
        if (i === 4) await capture(page, `${tagBase}-06-${s.kind}`);
        if (i === 8) await capture(page, `${tagBase}-07-${s.kind}`);
        await step(page, lang);
      }

      await goHome(page);
      await page.locator('.home__nav .btn').nth(1).click();
      await page.waitForSelector('.profile__card');
      await capture(page, `${tagBase}-08-profile`);

      await goHome(page);
      await page.locator('.home__nav .btn').nth(2).click();
      await page.waitForSelector('.howto__steps');
      await capture(page, `${tagBase}-09-howto`);

      await goHome(page);
      await page.locator('.home__nav .btn').nth(3).click();
      await page.waitForSelector('.modal');
      await capture(page, `${tagBase}-10-settings`);

      await page.context().close();
    }
  }

  await browser.close();
  console.log(problems === 0 ? '\n✓ no layout problems\n' : `\n${problems} layout problem(s)\n`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
