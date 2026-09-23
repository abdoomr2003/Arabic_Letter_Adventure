/**
 * A solver that plays the game through the DOM, the way a person would.
 *
 * It reads only what is actually on screen — the prompt, the glyph on each tile,
 * the word being shown — and works out the answer with the same Arabic rules the
 * game uses (imported from src/, so the test and the game can never drift apart).
 * It never reaches into React state and there is no test-only hook in the app.
 */
import type { Page } from 'playwright';
import { translate } from '../src/data/i18n';
import { LETTERS, letterByChar } from '../src/data/letters';
import {
  ZWJ, analyzeWord, normalizeLetter, sameLetter, slotOf, splitLetters, wordHasLetterAt,
  type Position, type Slot,
} from '../src/game/arabic';
import { clueDeck, duelCandidates, answerFor } from '../src/game/duel';
import { makeRng } from '../src/game/rng';

type Lang = 'ar' | 'en';

const ARABIC_LETTER = /[ء-ي]/;

/** The letter the current challenge is about, read off the screen. */
export async function targetLetter(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const badge = document.querySelector('.targetbadge__glyph')?.textContent?.trim();
    if (badge) return badge;
    const rush = document.querySelector('.rush__letter')?.textContent?.trim();
    if (rush) return rush;
    const prompt = document.querySelector('.challenge__prompt, .rush__prompt')?.textContent ?? '';
    const m = prompt.match(/[ء-ي]/);
    return m ? m[0] : null;
  });
}

const strip = (s: string) => s.replace(/[‍‎‏⁦-⁩]/g, '').trim();

/** Decode which contextual form a rendered ZWJ string represents. */
export function positionOfRendered(text: string): Position {
  const lead = text.startsWith(ZWJ);
  const trail = text.endsWith(ZWJ);
  if (lead && trail) return 'medial';
  if (lead) return 'final';
  if (trail) return 'initial';
  return 'isolated';
}

export interface Snapshot {
  kind:
    | 'discovery' | 'shifter' | 'shifter-finale' | 'shapeMatch' | 'hunt' | 'build'
    | 'mcq' | 'duel-choose' | 'duel' | 'duel-won' | 'rush-intro' | 'rush' | 'rush-over'
    | 'result' | 'fail' | 'unknown';
  prompt: string;
  lives: number;
  maxLives: number;
  score: number;
  combo: string | null;
}

export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const has = (s: string) => !!document.querySelector(s);
    const text = (s: string) => document.querySelector(s)?.textContent?.trim() ?? '';
    let kind = 'unknown';
    if (has('.result__shield')) kind = 'result';
    else if (has('.fail__card')) kind = 'fail';
    else if (has('.rush__introcard')) kind = 'rush-intro';
    else if (has('.rush__overcard')) kind = 'rush-over';
    else if (has('.rush__choices')) kind = 'rush';
    else if (has('.duel__wonpanel')) kind = 'duel-won';
    else if (has('.duel__grid--choose')) kind = 'duel-choose';
    else if (has('.duel__grid')) kind = 'duel';
    else if (has('.discovery__glyph')) kind = 'discovery';
    else if (has('.shifter__finale')) kind = 'shifter-finale';
    else if (has('.shifter__slots')) kind = 'shifter';
    else if (has('.challenge__counter')) kind = 'shapeMatch';
    else if (has('.hunt')) kind = 'hunt';
    else if (has('.build__pieces')) kind = 'build';
    else if (has('.optgrid')) kind = 'mcq';

    const hearts = [...document.querySelectorAll('.pill--hearts .heart')];
    const scorePill = [...document.querySelectorAll('.pill')]
      .find((p) => p.textContent?.includes('🏆'));
    return {
      kind,
      prompt: text('.challenge__prompt') || text('.rush__prompt') || text('.duel__title'),
      lives: hearts.filter((h) => !h.classList.contains('heart--lost')).length,
      maxLives: hearts.length,
      score: Number((scorePill?.textContent ?? '0').replace(/[^\d]/g, '')) || 0,
      combo: text('.combo') || null,
    };
  }) as Promise<Snapshot>;
}

/** Tiles of the option grid, with the glyph each one is showing. */
async function optionTiles(page: Page, selector = '.optgrid .tile') {
  return page.$$eval(selector, (els) =>
    els.map((el, i) => ({
      i,
      text: el.querySelector('.tile__glyph, .tile__label--big')?.textContent ?? el.textContent ?? '',
      disabled: (el as HTMLButtonElement).disabled,
      label: el.querySelector('.tile__label')?.textContent ?? '',
    })),
  );
}

const slotLabels = (lang: Lang): Record<string, Slot> => ({
  [translate(lang, 'slot.start')]: 'start',
  [translate(lang, 'slot.middle')]: 'middle',
  [translate(lang, 'slot.end')]: 'end',
});

const positionLabels = (lang: Lang): Record<string, Position> => ({
  [translate(lang, 'pos.isolated')]: 'isolated',
  [translate(lang, 'pos.initial')]: 'initial',
  [translate(lang, 'pos.medial')]: 'medial',
  [translate(lang, 'pos.final')]: 'final',
});

export interface SolveResult { acted: boolean; intendedCorrect: boolean; note?: string }

/**
 * Take one correct action on whatever is on screen.
 * `wrongOnPurpose` makes it pick a deliberately wrong option instead, so the
 * failure paths can be exercised for real.
 */
export async function step(
  page: Page, lang: Lang, opts: { wrongOnPurpose?: boolean } = {},
): Promise<SolveResult> {
  const snap = await snapshot(page);
  const wrong = !!opts.wrongOnPurpose;

  switch (snap.kind) {
    case 'discovery': {
      await page.waitForTimeout(2800);
      await page.click('.discovery__cta .btn');
      return { acted: true, intendedCorrect: true, note: 'discovery' };
    }

    case 'shifter-finale': {
      await page.click('.challenge__foot .btn');
      return { acted: true, intendedCorrect: true, note: 'shifter finale' };
    }

    case 'shifter': {
      const labels = slotLabels(lang);
      const want = Object.entries(labels).find(([txt]) => snap.prompt.includes(txt))?.[1] ?? 'start';
      const order: Slot[] = ['start', 'middle', 'end'];
      let idx = order.indexOf(want);
      if (wrong) idx = (idx + 1) % 3;
      const slots = page.locator('.shifter__slot:not([disabled])');
      if (await slots.count() <= idx) return { acted: false, intendedCorrect: false };
      await slots.nth(idx).click();
      await page.waitForTimeout(400);
      const next = page.locator('.challenge__foot .btn');
      if (await next.count()) await next.first().click();
      await page.waitForTimeout(350);
      return { acted: true, intendedCorrect: !wrong, note: `shifter → ${want}` };
    }

    case 'shapeMatch': {
      const target = await targetLetter(page);
      if (!target) return { acted: false, intendedCorrect: false };
      const tiles = await optionTiles(page, '.optgrid--dense .tile');
      const mine = tiles.filter((t) => !t.disabled && sameLetter(strip(t.text), target));
      const pickIdx = wrong
        ? tiles.find((t) => !t.disabled && !sameLetter(strip(t.text), target))?.i
        : mine[0]?.i;
      if (pickIdx === undefined) {
        const done = page.locator('.challenge__foot .btn');
        if (await done.count()) { await done.first().click(); await page.waitForTimeout(300); return { acted: true, intendedCorrect: true }; }
        return { acted: false, intendedCorrect: false };
      }
      await page.locator('.optgrid--dense .tile').nth(pickIdx).click();
      await page.waitForTimeout(280);
      const done = page.locator('.challenge__foot .btn');
      if (await done.count()) { await done.first().click(); await page.waitForTimeout(350); }
      return { acted: true, intendedCorrect: !wrong, note: 'shape match' };
    }

    case 'hunt': {
      const target = await targetLetter(page);
      if (!target) return { acted: false, intendedCorrect: false };
      const cells = await page.$$eval('.aword__cell--tap', (els) =>
        els.map((el, i) => ({ i, label: el.getAttribute('aria-label') ?? '', disabled: (el as HTMLButtonElement).disabled })));
      const good = cells.find((c) => !c.disabled && sameLetter(c.label, target));
      const bad = cells.find((c) => !c.disabled && !sameLetter(c.label, target));
      const chosen = wrong ? (bad ?? good) : (good ?? bad);
      if (!chosen) return { acted: false, intendedCorrect: false };
      await page.locator('.aword__cell--tap').nth(chosen.i).click();
      await page.waitForTimeout(850);
      const next = page.locator('.challenge__foot .btn');
      if (await next.count()) { await next.first().click(); await page.waitForTimeout(500); }
      return { acted: true, intendedCorrect: !wrong, note: 'word hunt' };
    }

    case 'build': {
      // The target word is quoted in the prompt.
      const m = snap.prompt.match(/[“"«]([^”"»]+)[”"»]/);
      const word = m ? m[1] : null;
      if (!word) return { acted: false, intendedCorrect: false };
      let order = splitLetters(word).map((l) => l.base);
      if (wrong && order.length > 1) order = [order[1], order[0], ...order.slice(2)];
      for (const ch of order) {
        const pieces = await page.$$eval('.build__pieces .tile', (els) =>
          els.map((el, i) => ({ i, text: el.textContent ?? '', disabled: (el as HTMLButtonElement).disabled })));
        const hit = pieces.find((p) => !p.disabled && strip(p.text) === ch);
        if (!hit) break;
        await page.locator('.build__pieces .tile').nth(hit.i).click();
        await page.waitForTimeout(110);
      }
      const confirm = page.locator('.challenge__foot .btn').first();
      if (await confirm.count()) await confirm.click();
      await page.waitForTimeout(900);
      const next = page.locator('.challenge__foot .btn');
      if (await next.count()) { await next.first().click(); await page.waitForTimeout(500); }
      return { acted: true, intendedCorrect: !wrong, note: `build ${word}` };
    }

    case 'mcq': {
      const target = await targetLetter(page);
      if (!target) return { acted: false, intendedCorrect: false };
      const tiles = await optionTiles(page);
      const live = tiles.filter((t) => !t.disabled);
      if (!live.length) return { acted: false, intendedCorrect: false };

      let correctIdx: number | undefined;

      // Position / slot questions: work it out from the word or the rendered form.
      const wordText = await page.evaluate(() =>
        document.querySelector('.challenge__word .aword__text')?.textContent ?? null);
      const heroForm = await page.evaluate(() =>
        document.querySelector('.challenge__formhero')?.textContent ?? null);

      if (wordText) {
        const letters = analyzeWord(wordText);
        const idx = letters.findIndex((l) => sameLetter(l.base, target));
        const slot = slotOf(idx, letters.length);
        const want = translate(lang, `slot.${slot}`);
        correctIdx = live.find((t) => strip(t.text) === strip(want))?.i;
      } else if (heroForm) {
        const pos = positionOfRendered(heroForm);
        const want = translate(lang, `pos.${pos}`);
        correctIdx = live.find((t) => strip(t.text) === strip(want))?.i;
      } else {
        correctIdx = live.find((t) => sameLetter(strip(t.text), target))?.i;
      }

      const wrongIdx = live.find((t) => t.i !== correctIdx)?.i;
      const pickIdx = wrong ? (wrongIdx ?? correctIdx) : (correctIdx ?? live[0].i);
      if (pickIdx === undefined) return { acted: false, intendedCorrect: false };

      await page.locator('.optgrid .tile').nth(pickIdx).click();
      await page.waitForTimeout(900);
      const next = page.locator('.challenge__foot .btn');
      if (await next.count()) { await next.first().click(); await page.waitForTimeout(450); }
      return { acted: true, intendedCorrect: !wrong && correctIdx !== undefined, note: snap.prompt.slice(0, 40) };
    }

    case 'rush-intro': {
      await page.click('.rush__introcard .btn');
      return { acted: true, intendedCorrect: true, note: 'rush start' };
    }

    case 'rush-over': {
      await page.click('.rush__overcard .btn');
      return { acted: true, intendedCorrect: true, note: 'rush end' };
    }

    case 'rush': {
      const target = await targetLetter(page);
      const slotText = await page.evaluate(() =>
        document.querySelector('.rush__prompt')?.textContent ?? '');
      const labels = slotLabels(lang);
      const slot = Object.entries(labels).find(([txt]) => slotText.includes(txt))?.[1] ?? 'start';
      const choices = await page.$$eval('.rush__choices .tile', (els) =>
        els.map((el, i) => ({ i, word: el.querySelector('.aword__text')?.textContent ?? '', disabled: (el as HTMLButtonElement).disabled })));
      if (!target || !choices.length) return { acted: false, intendedCorrect: false };
      const good = choices.find((c) => !c.disabled && wordHasLetterAt(c.word, target, slot));
      const bad = choices.find((c) => !c.disabled && !wordHasLetterAt(c.word, target, slot));
      const chosen = wrong ? (bad ?? good) : (good ?? choices[0]);
      if (!chosen) return { acted: false, intendedCorrect: false };
      await page.locator('.rush__choices .tile').nth(chosen.i).click();
      await page.waitForTimeout(1800);
      return { acted: true, intendedCorrect: !wrong && !!good, note: `3-word ${slot}` };
    }

    case 'duel-choose': {
      await page.locator('.duel__grid--choose .tile').first().click();
      await page.waitForTimeout(400);
      return { acted: true, intendedCorrect: true, note: 'picked secret' };
    }

    case 'duel-won': {
      await page.click('.duel__wonpanel .btn');
      return { acted: true, intendedCorrect: true, note: 'duel won' };
    }

    case 'duel': {
      // If the rival is asking about our own secret, answer truthfully.
      const ask = await page.evaluate(() => document.querySelector('.duel__askq')?.textContent ?? null);
      if (ask) {
        const secret = await page.evaluate(() =>
          document.querySelector('.duel__secretglyph')?.textContent?.trim() ?? '');
        const truth = truthFor(ask, secret, lang);
        const say = wrong ? !truth : truth;
        await page.locator('.duel__ask .btn', {
          hasText: new RegExp(`^${translate(lang, say ? 'btn.yes' : 'btn.no')}$`),
        }).first().click();
        await page.waitForTimeout(450);
        return { acted: true, intendedCorrect: !wrong, note: `answered ${say ? 'yes' : 'no'}` };
      }

      // Read the grid and our own question log, and deduce like a player would.
      const grid = await page.$$eval('.duel__grid .tile', (els) => els.map((e, i) => ({
        i,
        ch: (e.querySelector('.tile__glyph')?.textContent ?? '').trim(),
        struck: e.classList.contains('tile--struck'),
      })));
      const log = await page.$$eval('.duel__logline--you', (els) => els.map((e) => ({
        text: e.textContent ?? '',
        yes: !!e.querySelector('.duel__ans.is-yes'),
        answered: !!e.querySelector('.duel__ans'),
      })));

      const deck = clueDeck(grid.map((g) => g.ch), makeRng(11));
      let alive = grid.filter((g) => !g.struck).map((g) => g.ch);
      for (const entry of log) {
        if (!entry.answered) continue;
        const clue = deck.find((c) => entry.text.includes(translate(lang, c.msgKey, c.vars).trim()));
        if (clue) alive = alive.filter((ch) => {
          const l = letterByChar(ch);
          return !!l && clue.test(l) === entry.yes;
        });
      }

      // Cross out what the clues have already ruled out (no-op when the game
      // already did it for us on the beginner worlds).
      const toStrike = grid.filter((g) => !g.struck && !alive.includes(g.ch));
      if (toStrike.length) {
        for (const g of toStrike.slice(0, 12)) {
          await page.locator('.duel__grid .tile').nth(g.i).click();
          await page.waitForTimeout(60);
        }
        return { acted: true, intendedCorrect: true, note: `ruled out ${toStrike.length}` };
      }

      const clues = await page.locator('.duel__clue').count();
      if (alive.length > 1 && clues > 0) {
        await page.locator('.duel__clue').nth(0).click();
        await page.waitForTimeout(550);
        return { acted: true, intendedCorrect: true, note: `asked a clue (${alive.length} left)` };
      }

      // Enough is known — guess.
      const guessBtn = page.locator('.duel__actions .btn').last();
      if (await guessBtn.count()) { await guessBtn.click(); await page.waitForTimeout(300); }
      const want = wrong
        ? grid.find((g) => !g.struck && !alive.includes(g.ch)) ?? grid.find((g) => !g.struck)
        : grid.find((g) => !g.struck && alive.includes(g.ch)) ?? grid.find((g) => !g.struck);
      if (!want) return { acted: false, intendedCorrect: false };
      await page.locator('.duel__grid .tile').nth(want.i).click();
      await page.waitForTimeout(700);
      return { acted: true, intendedCorrect: !wrong, note: `guessed ${want.ch} of ${alive.length}` };
    }

    default:
      return { acted: false, intendedCorrect: false };
  }
}

/**
 * Work out the honest answer to a rival's clue question, using the same clue
 * predicates the game uses.
 */
function truthFor(questionText: string, secret: string, lang: Lang): boolean {
  const l = letterByChar(secret);
  if (!l) return false;
  const deck = clueDeck(LETTERS.map((x) => x.char), makeRng(1));
  const match = deck.find((c) => translate(lang, c.msgKey, c.vars).trim() === questionText.trim());
  if (match) return answerFor(match, secret);
  // Fall back on the feature the wording names.
  const q = questionText.toLowerCase();
  if (q.includes('three')) return l.dots.count === 3;
  if (q.includes('one dot')) return l.dots.count === 1;
  if (q.includes('above')) return l.dots.place === 'above';
  if (q.includes('below')) return l.dots.place === 'below';
  if (q.includes('dots')) return l.dots.count > 0;
  if (q.includes('tail') || q.includes('below the line')) return l.descends;
  if (q.includes('tall')) return l.tall;
  if (q.includes('both sides')) return l.joining === 'dual';
  return false;
}

export { normalizeLetter, sameLetter, duelCandidates };
