import { useMemo, useState } from 'react';
import { useCurrentLevel, useDispatch } from '../game/state';
import { playSfx } from '../game/audio';
import { ArabicSpan, ArabicWord, RichText } from '../components/Arabic';
import { Button, Feedback, TimerChip, useCountdown, useSupport, useT } from '../components/ui';
import { buildThreeWords, slotLabelKey } from '../game/questions';
import { letterSpans, sameLetter, wordHasLetterAt } from '../game/arabic';
import { pick, makeRng } from '../game/rng';

/**
 * BOSS round two — the 3-Word Challenge, and the design's own rules 5 and 6:
 * "name 3 words containing the letter" / "at the beginning, middle or end".
 *
 * Each slot asks for the letter in one position, and every answer is checked by
 * re-analysing the real word, not against a stored answer key — a word counts as
 * correct only if the letter genuinely sits there.
 *
 * The timer is real: it counts down in wall-clock time, ends the round at zero,
 * and the round is scored on what was actually completed.
 */
export function ThreeWords({ letters, seconds }: { letters: string[]; seconds: number }) {
  const t = useT();
  const dispatch = useDispatch();
  const { showMeaning } = useSupport();
  const level = useCurrentLevel();
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);

  const target = useMemo(() => pick(makeRng(seed), letters), [letters, seed]);
  const slots = useMemo(
    () => buildThreeWords(target, seed, level?.tier ?? 'beginner'),
    [target, seed, level],
  );

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<{ ar: string; correct: boolean }[]>([]);
  const [over, setOver] = useState(false);
  const [feedback, setFeedback] = useState<{ good: boolean; text: string } | null>(null);

  const left = useCountdown(seconds, started && !over, () => {
    playSfx('lose');
    setOver(true);
  });

  const finish = () => dispatch({ type: 'phaseDone' });

  /* ------------------------------------------------------------------ intro */
  if (!started) {
    return (
      <div className="rush rush--intro">
        <div className="backdrop backdrop--soft rush__bg"
          style={{ backgroundImage: 'url(./art/bg-rush.jpg)' }} />
        <div className="rush__introcard anim-pop">
          <div className="timer timer--urgent" aria-hidden="true">
            ⏱️ {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </div>
          <h2 className="rush__introtitle">{t('boss.rushIntro', { s: seconds })}</h2>
          <p className="rush__introsub">
            <RichText>{t('boss.threeWordsHint', { letter: target })}</RichText>
          </p>
          <ArabicSpan className="hero-letter rush__introletter">{target}</ArabicSpan>
          <Button tone="green" size="lg" onClick={() => { playSfx('combo'); setStarted(true); }}>
            ▶ {t('btn.startGuess')}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- over */
  if (over || index >= slots.length) {
    const correct = picks.filter((p) => p.correct).length;
    return (
      <div className="rush rush--over">
        <div className="rush__overcard anim-pop">
          <h2 className="rush__introtitle">
            {over && index < slots.length ? t('fb.timeUp') : t('boss.defeated')}
          </h2>
          <p className="rush__score">{t('boss.wordsCorrect', { n: correct })}</p>
          <ul className="rush__summary">
            {slots.map((s, i) => {
              const p = picks[i];
              return (
                <li key={s.slot} className="rush__summaryrow">
                  <span className="rush__slotlabel">{t(slotLabelKey(s.slot))}</span>
                  <ArabicWord
                    word={s.answer}
                    size="clamp(1.3rem, 4.5vw, 1.9rem)"
                    highlight={letterSpans(s.answer.ar)
                      .filter((x) => sameLetter(x.base, target))
                      .map((x) => x.index)}
                  />
                  <span aria-hidden="true">{p ? (p.correct ? '✅' : '❌') : '⏳'}</span>
                </li>
              );
            })}
          </ul>
          <Button tone="green" size="lg" onClick={finish}>{t('btn.next')} ›</Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- play */
  const slot = slots[index];

  const choose = (ar: string) => {
    if (feedback) return;
    const word = slot.choices.find((w) => w.ar === ar)!;
    // Validated against the real word, never a stored flag.
    const correct = wordHasLetterAt(word.ar, target, slot.slot);
    setPicks([...picks, { ar, correct }]);
    dispatch({
      type: 'answer',
      correct,
      challenge: 'BOSS_THREE_WORDS',
      letter: target,
      ms: 1500,
      value: 200,
    });
    if (correct) dispatch({ type: 'wordDone' });
    playSfx(correct ? 'correct' : 'wrong');
    setFeedback({
      good: correct,
      text: correct
        ? t('fb.correctWord', { word: word.ar, meaning: word.en })
        : t('fb.wrongPos', { letter: target, where: t(slotLabelKey(slot.slot)) }),
    });
    window.setTimeout(() => {
      setFeedback(null);
      setIndex((n) => n + 1);
    }, correct ? 900 : 1600);
  };

  return (
    <div className="rush">
      <div className="backdrop backdrop--soft rush__bg"
        style={{ backgroundImage: 'url(./art/bg-rush.jpg)' }} />
      <div className="rush__bar">
        <TimerChip left={left} total={seconds} />
        <div className="rush__letter">
          <ArabicSpan className="hero-letter">{target}</ArabicSpan>
        </div>
        <div className="rush__chain">
          {slots.map((s, i) => (
            <span
              key={s.slot}
              className={`rush__link ${i < index ? (picks[i]?.correct ? 'is-done' : 'is-miss') : ''} ${i === index ? 'is-active' : ''}`}
            >
              {i < index ? (picks[i]?.correct ? '⭐' : '✕') : i === index ? '◆' : '🔒'}
            </span>
          ))}
        </div>
      </div>

      <h2 className="rush__prompt">
        <RichText>{t('q.pickWordWith', { letter: target, where: t(slotLabelKey(slot.slot)) })}</RichText>
      </h2>
      <p className="rush__slotname">{t(`boss.wordSlot${index + 1}`)}</p>

      <div className="rush__choices stagger">
        {slot.choices.map((w) => (
          <button
            key={w.ar}
            type="button"
            className="tile tile--word"
            disabled={!!feedback}
            onClick={() => choose(w.ar)}
          >
            {w.emoji && <span className="tile__emoji" aria-hidden="true">{w.emoji}</span>}
            <ArabicWord word={w} size="clamp(1.5rem, 5vw, 2.2rem)" />
            {showMeaning && <span className="tile__label">{w.en}</span>}
          </button>
        ))}
      </div>

      {feedback && <Feedback good={feedback.good}>{feedback.text}</Feedback>}
    </div>
  );
}
