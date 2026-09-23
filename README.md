# مغامرة تحدي الحروف · Arabic Letter Adventure

A playable adventure game that teaches the Arabic alphabet — and, above all, teaches
that **a letter changes its shape depending on where it sits in a word, while staying
the same letter**.

Built from the *Arabic Letter Adventure* design deck: its seven letter worlds, its
Secret Letter duel, its 3-word challenge, its hearts/coins/stars economy and its
visual identity are all preserved, with the contextual-form system built out into the
core of the gameplay.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build and preview:

```bash
npm run build
npm run preview    # http://localhost:4173
```

Checks:

```bash
npm run typecheck      # tsc --noEmit
npm run check:content   # verifies the letter/word data can feed every challenge
npm run playtest        # plays the game in a real browser (needs `npm run dev`)
npm run deeptest        # plays the intermediate/advanced levels and the boss
```

`npm run playtest -- --shots --shotdir /tmp/shots` writes screenshots as it plays.

No backend, no accounts, no network calls at runtime. Fonts and artwork are bundled.

---

## How Arabic joining is handled

This is the part that matters most, so it has one rule and one home:
[`src/game/arabic.ts`](src/game/arabic.ts).

A letter's identity is **always** its plain Unicode code point (`ب` = U+0628).
A contextual form is never stored as a separate character, never a presentation-form
code point (U+FExx), and never faked with CSS. Instead the real letter is handed to
the browser's own shaping engine wrapped in ZERO WIDTH JOINER (U+200D):

| position | string handed to the renderer | renders as |
| --- | --- | --- |
| isolated | `ب` | ب |
| initial | `ب` + ZWJ | بـ |
| medial | ZWJ + `ب` + ZWJ | ـبـ |
| final | ZWJ + `ب` | ـب |

Because the shaping engine does the work, letters with restricted joining behaviour
come out right for free: `availablePositions('د')` returns two positions, not four,
and asking for د's "initial" form yields the isolated glyph because د does not join
forward. The game never invents four shapes for a letter that only has two, and says
so out loud on the discovery screen.

Where a letter sits inside a word is likewise **derived**, not annotated:
`analyzeWord()` applies the real joining rules, so the word bank stores only words
and meanings and can never disagree with what is on screen. `بَاب` is a good example
— the game correctly reports the final ب as *isolated*, because ا does not connect
to what follows it.

Words are always rendered as a single text run so the browser joins them. When
individual letters have to be tappable or highlighted (Word Hunter, position
questions), their boxes are measured with DOM `Range`s and overlaid — splitting the
word into per-letter elements would break the very joining the game is teaching.

Reference: [Unicode Core Specification, chapter 9](https://www.unicode.org/versions/Unicode18.0.0/core-spec/chapter-9/).

---

## The game

```
HOME ─ language ─▶ WORLD MAP ─▶ WORLD ─▶ LEVEL
                                          │
                       LETTER DISCOVERY ──┤
                       challenges (rotating per tier)
                       SHAPE SHIFTER ─────┤
                                          ▼
                       RESULT ◀── or ── FAILURE ── retry
                         │
                    unlocks next level / world
```

### Seven worlds, each a shape family

| # | World | Letters | Why they live together |
| --- | --- | --- | --- |
| 1 | مملكة الملك الألف · Kingdom of King Alif | ا | Stands tall, never joins forward |
| 2 | مدينة الأطباق · City of Plates | ب ت ث ف | Same plate — only the dots differ |
| 3 | مجموعة البطون · Village of Bellies | ج ح خ ع غ ه | Round belly below the line |
| 4 | مدينة الكراسي · City of Chairs | د ذ | Chairs that only join backwards |
| 5 | وادي الثعابين · Valley of Snakes | ر ز و م | Tails that slide below the line |
| 6 | بحيرة السباحين · Swimmers' Lake | س ش ص ض ن ق ي | Floating basins, several near-identical |
| 7 | برج المئذنة · Minaret Tower | ط ظ ك ل | The tall letters |

All 28 letters, one level each, plus a boss per world — 35 levels in total.

### Challenge types

Every one is generated from data by [`src/game/questions.ts`](src/game/questions.ts)
and rendered by one engine ([`src/challenges/Engine.tsx`](src/challenges/Engine.tsx)).

| Type | What the learner does |
| --- | --- |
| `LETTER_DISCOVERY` | Meets the letter; its forms are revealed one at a time, each landing in a real word |
| `LETTER_IDENTIFICATION` | Finds the letter among others |
| `SAME_LETTER` | Picks which contextual shape belongs to the target letter |
| `CONTEXTUAL_FORM` | Sees a shape, says where in a word it is used |
| `SHAPE_SHIFTER` | Moves the letter to the beginning / middle / end and watches it transform |
| `SHAPE_MATCH` | Collects every shape of one letter out of a mixed pile |
| `POSITION_DETECTION` | Says where the letter sits inside a shown word |
| `WORD_HUNT` | Taps the letter inside a joined word |
| `WORD_BUILD` | Orders loose letters into a word and watches them connect |
| `SIMILAR_LETTER` | Tells ب / ت / ث apart by shape + dots + position |
| `TIMED_RECOGNITION` | 30-second Letter Rush |
| `BOSS_SECRET_LETTER` | The duel (below) |
| `BOSS_THREE_WORDS` | Names 3 words with the letter at the beginning, middle and end, against a clock |

Which types a level uses comes from its tier, and any phase the letter cannot support
is dropped — a د level never asks for a medial form.

### The boss: Secret Letter Challenge

Straight out of the deck's own rulebook — *choose a secret letter, write it down,
guess your rival's letter, first to discover it wins, then name 3 words containing
it, at the beginning, middle or end*.

Both sides really deduce. The rival keeps its own candidate list and asks the question
that best halves it; it narrows that list with the answer **you** give about **your**
secret. So the way to keep your letter safe is to actually know its dots, its tail,
its height and its joining — answering wrongly costs a heart and is corrected on the
spot. In the beginner worlds a clue crosses out what it eliminates for you; from the
middle worlds on, applying the clue is your job.

### Hearts, score, stars, coins, XP

All derived from play, in [`src/game/scoring.ts`](src/game/scoring.ts):

- A wrong answer costs one of three hearts; zero hearts ends the attempt.
- Score = base value × combo multiplier (×2 at 5 correct, ×3 at 10, ×4 at 15) plus a
  small, capped speed bonus.
- ★ finished · ★★ ≥70% accuracy with a heart to spare · ★★★ hit the level's mastery
  accuracy without losing a heart.
- Coins and XP scale with the star grade; badges unlock from real thresholds.
- A failed attempt grants nothing and takes nothing away.

### Adaptive difficulty

[`src/game/adaptive.ts`](src/game/adaptive.ts) tracks per-letter accuracy, response
time, and mistakes split by *kind* — contextual-form errors, similar-letter errors,
word errors. Repeated similar-letter confusion adds similar-letter questions to the
next level; repeated form errors add form questions. Difficulty grows conceptually,
not by shortening the timer.

---

## Bilingual

`العربية | English` switches the whole interface, including direction (RTL ⇄ LTR),
and the choice is saved. The Arabic letters and words themselves are never
translated or replaced — English mode adds the letter name, a phonetic hint,
transliteration and the meaning *underneath* the Arabic, which stays the hero of
every screen. Transliteration can be turned off.

Arabic runs inside English sentences are wrapped in `<bdi>` and set in the Arabic
face, so `Find the letter ب` never reorders and a bare ا never reads as a Latin `l`.

---

## Architecture

```
src/
  game/
    arabic.ts        joining, shaping, word analysis  ← the Arabic rules live here only
    types.ts         shared types
    state.ts         the single game store (reducer + context + selectors)
    persistence.ts   the only module that touches localStorage
    questions.ts     generates every challenge from data
    duel.ts          the boss duel's clue logic and rival AI
    scoring.ts       combos, speed bonus, star grading, player level
    adaptive.ts      per-letter mastery and what to practise next
    audio.ts         synthesised SFX, generated music, speech-synthesis pronunciation
    rng.ts           seeded RNG
  data/
    letters.ts       28 letters: names, sounds, dots, confusables, world, joining
    words.ts         the word bank (positions are derived, never annotated)
    worlds.ts        the seven worlds
    levels.ts        levels generated from world data + unlock rules
    rewards.ts       badges
    i18n.ts          the ar/en string table
  components/        Arabic renderers + the shared UI kit
  challenges/        one component per challenge type, behind one engine
  screens/           home, map, world, play, result, fail, profile, how-to, settings
  styles/            tokens, UI kit, animations, screen layouts
public/
  art/               artwork extracted from the design deck
  fonts/             Noto Naskh Arabic, Baloo Bhaijaan 2, Fredoka (self-hosted)
scripts/
  check-content.ts   data self-check
  solver.ts          plays the game through the DOM using the game's own Arabic rules
  playtest.ts        full playthrough in a real browser
  deeptest.ts        intermediate / advanced / boss playthrough
```

Adding a letter is a data change: put it in `data/letters.ts`, add it to a world's
`letters` array, add a few words. `levels.ts` generates the level, the engine
generates the challenges, and the map picks it up.

---

## Audio

Sound effects are synthesised with the Web Audio API and the background music is
generated, so both are real sound with nothing to download. Letter and word
pronunciation uses the browser's own speech synthesis when an Arabic voice is
installed; when there is none, the speaker controls stay hidden rather than
pretending to play something. Recorded clips can be dropped in later without
touching call sites — see `registerClip` in `src/game/audio.ts` and the `audio`
field on each letter.

---

## Accessibility

- Sound, music, reduced motion, transliteration and high contrast are all toggles,
  all saved.
- Reduced motion honours the OS setting as well as the in-game switch.
- Correct / wrong / locked / completed are never communicated by colour alone — each
  carries a mark, an icon or a border change.
- Touch targets are at least 44px; the game plays on phone, tablet and desktop, with
  mouse, touch and keyboard, and `Esc` leaves a level or closes a dialog.
- Live regions announce feedback; the letter grid, hearts and timers carry labels.

---

## Persistence

Everything durable — language and settings, profile, unlocked and completed levels,
stars, best scores, coins, XP, per-letter mastery, badges — is saved to
`localStorage` under one key, through one module. Writes are debounced and flushed
when the page goes away. If storage is unavailable (private mode, blocked cookies)
the game still plays and the settings screen says progress will not be saved.
