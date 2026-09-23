/**
 * Boss balance measurement.
 *
 * Plays each world tier's Secret Letter duel repeatedly, playing it *correctly*
 * every time, and reports how often the learner actually wins.  The duel is a
 * race against a rival that is also deducing, so "is it winnable?" is a question
 * with a number behind it rather than an opinion — this is how that number gets
 * checked after any change to the rival's logic.
 *
 *   npm run balance            (needs `npm run dev`)
 *   npm run balance -- --runs 12
 */
import { chromium } from 'playwright';
import { snapshot, step } from './solver';
import { LEVEL_ORDER } from '../src/data/levels';
import { WORLDS } from '../src/data/worlds';

const args = process.argv.slice(2);
const flag = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const URL = flag('--url') ?? 'http://localhost:5173';
const RUNS = Number(flag('--runs') ?? 8);

/** A save that has everything before `bossId` finished. */
function seed(bossId: string) {
  const upto = LEVEL_ORDER.indexOf(bossId);
  const levels: Record<string, unknown> = {};
  for (const id of LEVEL_ORDER.slice(0, upto)) {
    levels[id] = { completed: true, stars: 3, bestScore: 1, bestAccuracy: 1, bestCombo: 1, plays: 1 };
  }
  return JSON.stringify({
    version: 1,
    settings: { lang: 'en', sound: false, music: false, reducedMotion: true, transliteration: true, highContrast: false },
    profile: { name: 'Balance', avatar: '🦊', createdAt: 1 },
    progress: { xp: 1, coins: 1, totalScore: 1, levels, mastery: {}, unlockedRewards: [], bestCombo: 1, wordsCompleted: 0, lastPlayed: 1 },
  });
}

const TARGETS = [
  { boss: 'alif-boss', world: 'alif', tier: 'beginner' },
  { boss: 'chairs-boss', world: 'chairs', tier: 'intermediate' },
  { boss: 'minaret-boss', world: 'minaret', tier: 'advanced' },
] as const;

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
  let worst = 1;

  for (const target of TARGETS) {
    const worldIndex = WORLDS.findIndex((w) => w.id === target.world);
    let wins = 0;
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
      await ctx.addInitScript(([s]: string[]) => {
        (window as unknown as { __name: unknown }).__name = (f: unknown) => f;
        try { localStorage.setItem('arabic-letter-adventure/save', s); } catch { /* ignore */ }
      }, [seed(target.boss)]);
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('.home__title');
      await page.locator('.home__nav .btn').first().click();
      await page.waitForSelector('.map__road');
      await page.locator('.map__node').nth(worldIndex).locator('.map__island').click();
      await page.waitForSelector('.world__levels');
      await page.locator('.lvl--boss .btn').click();
      await page.waitForSelector('.duel__grid--choose');

      for (let i = 0; i < 50; i++) {
        const s = await snapshot(page);
        if (['duel-won', 'rush-intro', 'result'].includes(s.kind)) { wins++; break; }
        if (s.kind === 'fail') break;
        await step(page, 'en');
        await page.waitForTimeout(120);
      }
      await ctx.close();
    }
    const rate = wins / RUNS;
    worst = Math.min(worst, rate);
    console.log(`  ${target.tier.padEnd(13)} ${wins}/${RUNS} duels won  (${Math.round(rate * 100)}%)`);
  }

  await browser.close();
  // A boss that a correctly-playing learner loses more than half the time is not
  // a challenge, it is a wall.
  const ok = worst >= 0.5;
  console.log(ok ? '\n✓ every boss is winnable when played correctly\n' : '\n✗ a boss is too hard\n');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
