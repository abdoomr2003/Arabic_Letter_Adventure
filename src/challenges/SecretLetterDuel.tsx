import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentLevel, useDispatch } from '../game/state';
import { playSfx } from '../game/audio';
import { ArabicSpan } from '../components/Arabic';
import { Button, Feedback, Panel, useT } from '../components/ui';
import { dotsPhrase, nameOf } from './kit';
import {
  answerFor, applyClue, clueDeck, duelCandidates, makeRival,
  rivalChooseClue, rivalGuess, rivalShouldGuess, type Clue, type RivalState,
} from '../game/duel';
import { makeRng, sample } from '../game/rng';
import { letterByChar } from '../data/letters';

type Stage = 'choose' | 'duel' | 'guessing' | 'won';

interface LogEntry { who: 'you' | 'rival'; text: string; answer?: boolean }

/**
 * BOSS — the Secret Letter Challenge, played exactly as the rulebook describes.
 *
 * Both sides hold a secret and both sides really deduce.  The rival asks the
 * question that best halves its own candidate list and narrows it with the answer
 * *you* give about *your* letter — so answering wrongly costs a heart and is
 * corrected on the spot.  Knowing your letter's dots, tail, height and joining is
 * how you keep your secret, which is the whole lesson of the world you just played.
 */
export function SecretLetterDuel({ letters }: { letters: string[] }) {
  const t = useT();
  const dispatch = useDispatch();
  const level = useCurrentLevel();
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);

  const candidates = useMemo(
    () => duelCandidates(letters, Math.max(9, Math.min(12, letters.length + 6)), seed),
    [letters, seed],
  );
  const deck = useMemo(() => clueDeck(candidates, makeRng(seed + 1)), [candidates, seed]);

  const [stage, setStage] = useState<Stage>('choose');
  const [secret, setSecret] = useState<string | null>(null);
  const [rival, setRival] = useState<RivalState>(() => makeRival(candidates, seed + 2));
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [myClues, setMyClues] = useState<string[]>([]);
  const [pending, setPending] = useState<Clue | null>(null);
  const [correction, setCorrection] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const started = useRef(performance.now());

  // In the first worlds the learner is still getting used to the idea of ruling
  // letters out, so a clue crosses out what it eliminates for them.  From the
  // middle worlds on, applying the clue is their job — that is the deduction.
  const autoStrike = (level?.tier ?? 'beginner') === 'beginner';

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [log]);

  /* ------------------------------------------------------------ choose secret */
  if (stage === 'choose') {
    return (
      <div className="duel">
        <header className="duel__head">
          <h2 className="duel__title">{t('boss.step1')}</h2>
          <p className="duel__sub">{t('boss.step1hint')}</p>
        </header>
        <div className="duel__grid duel__grid--choose">
          {candidates.map((c) => (
            <button
              key={c}
              type="button"
              className="tile"
              onClick={() => {
                playSfx('reveal');
                setSecret(c);
                setStage('duel');
                started.current = performance.now();
              }}
            >
              <ArabicSpan className="tile__glyph">{c}</ArabicSpan>
              <span className="tile__label">{nameOf(t, c)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const rivalSecret = rival.secret;

  /* --------------------------------------------------------------- your move */
  const availableClues = deck.filter((c) => !myClues.includes(c.id));
  const offered = sample(makeRng(seed + round * 31), availableClues, 3);

  const askClue = (clue: Clue) => {
    const yes = answerFor(clue, rivalSecret);
    setMyClues([...myClues, clue.id]);
    if (autoStrike) {
      const keep = new Set(applyClue(clue, candidates, yes));
      setStruck((s) => {
        const n = new Set(s);
        for (const c of candidates) if (!keep.has(c)) n.add(c);
        return n;
      });
    }
    setLog((l) => [...l, {
      who: 'you',
      text: t(clue.msgKey, clue.vars),
      answer: yes,
    }]);
    playSfx('click');
    rivalTurn();
  };

  /* ------------------------------------------------------------- rival's move */
  const rivalTurn = () => {
    const clue = rivalChooseClue(rival, deck);
    if (rivalShouldGuess(rival, deck) || !clue) {
      const guess = rivalGuess(rival, seed + round * 7);
      const right = guess === secret;
      setLog((l) => [...l, {
        who: 'rival',
        text: `${t('boss.rivalGuessed', { letter: guess })} — ${right ? t('boss.rivalRight') : t('boss.rivalWrong')}`,
      }]);
      if (right) {
        playSfx('lose');
        dispatch({ type: 'loseLevel' });
      } else {
        // A wrong guess costs the rival that candidate.
        setRival((r) => ({ ...r, candidates: r.candidates.filter((c) => c !== guess) }));
        setRound((n) => n + 1);
      }
      return;
    }
    setPending(clue);
  };

  const answerRival = (said: boolean) => {
    if (!pending || !secret) return;
    const truth = answerFor(pending, secret);
    const correct = said === truth;
    dispatch({
      type: 'answer',
      correct,
      challenge: 'BOSS_SECRET_LETTER',
      letter: secret,
      ms: performance.now() - started.current,
      value: 120,
    });
    playSfx(correct ? 'correct' : 'wrong');
    if (!correct) {
      setCorrection(t('boss.truthWas', {
        letter: secret,
        answer: truth ? t('btn.yes') : t('btn.no'),
      }));
    } else {
      setCorrection(null);
    }
    // The rival always narrows using the *true* answer, so the duel stays fair.
    setRival((r) => ({
      ...r,
      used: [...r.used, pending.id],
      candidates: applyClue(pending, r.candidates, truth),
    }));
    setLog((l) => [...l, {
      who: 'rival',
      text: t(pending.msgKey, pending.vars),
      answer: truth,
    }]);
    setPending(null);
    setRound((n) => n + 1);
    started.current = performance.now();
  };

  /* ---------------------------------------------------------------- guessing */
  const makeGuess = (c: string) => {
    const right = c === rivalSecret;
    dispatch({
      type: 'answer',
      correct: right,
      challenge: 'BOSS_SECRET_LETTER',
      letter: c,
      ms: performance.now() - started.current,
      value: 400,
    });
    if (right) {
      playSfx('win');
      setStage('won');
    } else {
      playSfx('wrong');
      setStruck((s) => new Set(s).add(c));
      setStage('duel');
      setLog((l) => [...l, { who: 'you', text: `${t('boss.rivalGuessed', { letter: c })} — ${t('boss.rivalWrong')}` }]);
      rivalTurn();
    }
  };

  if (stage === 'won') {
    return (
      <div className="duel duel--won">
        <div className="duel__wonpanel anim-pop">
          <span className="duel__wontrophy" aria-hidden="true">🏆</span>
          <h2 className="duel__title">{t('boss.youWin')}</h2>
          <p className="duel__sub">
            <ArabicSpan className="duel__reveal">{rivalSecret}</ArabicSpan>
            <span> — {nameOf(t, rivalSecret)}</span>
          </p>
          <Button tone="green" size="lg" onClick={() => dispatch({ type: 'phaseDone' })}>
            {t('btn.next')} ›
          </Button>
        </div>
      </div>
    );
  }

  const l = secret ? letterByChar(secret) : null;

  return (
    <div className="duel">
      <header className="duel__head">
        <h2 className="duel__title">{t('boss.guessTitle')}</h2>
        <p className="duel__sub">{t(autoStrike ? 'boss.autoRule' : 'boss.tapToRule')}</p>
      </header>

      <div className="duel__cols">
        {/* ——— the grid you are deducing over ——— */}
        <div className="duel__gridwrap">
          <div className="duel__grid">
            {candidates.map((c) => {
              const out = struck.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`tile tile--duel ${out ? 'tile--struck' : ''}`}
                  aria-pressed={out}
                  onClick={() => {
                    if (stage === 'guessing') { makeGuess(c); return; }
                    playSfx('click');
                    setStruck((s) => {
                      const n = new Set(s);
                      if (n.has(c)) n.delete(c); else n.add(c);
                      return n;
                    });
                  }}
                >
                  <ArabicSpan className="tile__glyph">{c}</ArabicSpan>
                </button>
              );
            })}
          </div>
          <p className="duel__gridnote">
            {t('boss.remaining', { n: candidates.length - struck.size })}
          </p>
        </div>

        {/* ——— your secret, the rival, and the question log ——— */}
        <div className="duel__side">
          <Panel variant="glass" className="duel__secret">
            <span className="duel__secretlabel">{t('boss.yourSecret')}</span>
            <ArabicSpan className="duel__secretglyph">{secret ?? ''}</ArabicSpan>
            {l && <span className="duel__secretname">{nameOf(t, l.char)}</span>}
          </Panel>

          <div className="duel__log" ref={logRef}>
            {log.map((e, i) => (
              <p key={i} className={`duel__logline duel__logline--${e.who}`}>
                <b>{e.who === 'you' ? t('boss.yourTurn') : t('boss.rivalTurn')}:</b> {e.text}
                {e.answer !== undefined && (
                  <span className={`duel__ans ${e.answer ? 'is-yes' : 'is-no'}`}>
                    {e.answer ? t('btn.yes') : t('btn.no')}
                  </span>
                )}
              </p>
            ))}
            {log.length === 0 && <p className="duel__logline muted">{t('boss.clueTitle')}</p>}
          </div>
        </div>
      </div>

      {/* ——— the rival is asking you about your own letter ——— */}
      {pending && (
        <Panel className="duel__ask anim-pop">
          <img src="./art/char-rival.jpg" alt="" className="duel__rival" />
          <div className="col grow">
            <span className="duel__asklabel">{t('boss.rivalAsks')}</span>
            <strong className="duel__askq">{t(pending.msgKey, pending.vars)}</strong>
            <span className="tiny muted">{t('boss.answerTruth')}</span>
          </div>
          <div className="row">
            <Button tone="green" onClick={() => answerRival(true)}>{t('btn.yes')}</Button>
            <Button tone="red" onClick={() => answerRival(false)}>{t('btn.no')}</Button>
          </div>
        </Panel>
      )}

      {correction && !pending && (
        <Feedback good={false}>
          {correction} {secret ? dotsPhrase(t, secret) : ''}
        </Feedback>
      )}

      {/* ——— your move ——— */}
      {!pending && stage === 'duel' && (
        <div className="duel__actions">
          <span className="duel__actionslabel">{t('boss.clueTitle')}</span>
          <div className="duel__clues">
            {offered.map((c) => (
              <button key={c.id} type="button" className="duel__clue" onClick={() => askClue(c)}>
                {t(c.msgKey, c.vars)}
              </button>
            ))}
            {offered.length === 0 && <span className="muted tiny">—</span>}
          </div>
          <Button tone="gold" onClick={() => { playSfx('click'); setStage('guessing'); }}>
            🎯 {t('btn.guessNow')}
          </Button>
        </div>
      )}

      {stage === 'guessing' && (
        <div className="duel__actions">
          <Feedback good icon="🎯">{t('boss.guessTitle')}</Feedback>
          <Button tone="ghost" onClick={() => setStage('duel')}>{t('btn.back')}</Button>
        </div>
      )}


    </div>
  );
}
