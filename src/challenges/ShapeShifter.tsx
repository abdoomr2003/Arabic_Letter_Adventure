import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useGame, useCurrentLevel } from '../game/state';
import { playSfx, pronounce } from '../game/audio';
import { ArabicSpan, ArabicWord, LetterForm, FormStrip } from '../components/Arabic';
import { Button, Feedback, useT } from '../components/ui';
import { ChallengeFrame, nameOf } from './kit';
import { availablePositions, letterSpans, sameLetter, type Position } from '../game/arabic';
import { positionLabelKey, shapeShiftSteps } from '../game/questions';
import { letterByChar } from '../data/letters';

const SLOT_FOR: Record<Position, 'start' | 'middle' | 'end'> = {
  isolated: 'start', initial: 'start', medial: 'middle', final: 'end',
};

/**
 * GAME 7 — Shape Shifter, the signature mechanic.
 *
 * The learner moves the letter into the beginning, the middle and the end of a
 * word, and watches it change shape under their hand each time.  The forms are
 * produced by real Unicode joining, and every step lands in a genuine word where
 * the letter truly takes that form — so the transformation the learner drives is
 * the transformation Arabic actually performs.
 */
export function ShapeShifter({ letter }: { letter: string }) {
  const t = useT();
  const dispatch = useDispatch();
  const { save } = useGame();
  const level = useCurrentLevel();
  const tier = level?.tier ?? 'beginner';

  const positions = availablePositions(letter);
  const steps = useMemo(
    () => shapeShiftSteps(letter, tier).filter((s) => s.position !== 'isolated'),
    [letter, tier],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [shown, setShown] = useState<Position>('isolated');
  const [wrong, setWrong] = useState<string | null>(null);
  const [morphKey, setMorphKey] = useState(0);
  const [finale, setFinale] = useState(steps.length === 0);
  const [finaleStep, setFinaleStep] = useState(0);
  const started = useRef(performance.now());

  const step = steps[stepIndex];
  const info = letterByChar(letter);

  // The closing reveal walks the whole chain: ب → بـ → ـبـ → ـب
  useEffect(() => {
    if (!finale) return;
    if (finaleStep >= positions.length - 1) return;
    const id = window.setTimeout(() => {
      setFinaleStep((n) => n + 1);
      playSfx('reveal');
    }, 850);
    return () => window.clearTimeout(id);
  }, [finale, finaleStep, positions.length]);

  const choose = (slot: 'start' | 'middle' | 'end') => {
    if (!step || wrong) return;
    const correct = SLOT_FOR[step.position] === slot;
    dispatch({
      type: 'answer',
      correct,
      challenge: 'SHAPE_SHIFTER',
      letter,
      ms: performance.now() - started.current,
      value: 150,
    });
    playSfx(correct ? 'correct' : 'wrong');
    if (!correct) { setWrong(slot); return; }
    setShown(step.position);
    setMorphKey((k) => k + 1);
    started.current = performance.now();
  };

  const advance = () => {
    setWrong(null);
    if (stepIndex + 1 < steps.length) {
      setStepIndex(stepIndex + 1);
      started.current = performance.now();
    } else {
      setFinale(true);
      setFinaleStep(0);
      playSfx('combo');
    }
  };

  const solvedThisStep = step && shown === step.position;

  /* ------------------------------------------------------------- the finale */
  if (finale) {
    return (
      <ChallengeFrame
        prompt={t('disc.sameLetter')}
        sub={positions.length > 2
          ? t('disc.fourForms', { name: nameOf(t, letter) })
          : t('disc.twoForms', { name: nameOf(t, letter) })}
        footer={
          <Button tone="green" size="lg" onClick={() => dispatch({ type: 'phaseDone' })}>
            {t('btn.next')} ›
          </Button>
        }
      >
        <div className="shifter__finale">
          <FormStrip
            char={letter}
            forms={positions}
            active={finaleStep}
            size="clamp(2.4rem, 8vw, 3.8rem)"
            labels={positions.map((p) => t(positionLabelKey(p)))}
          />
          <div className="shifter__examples">
            {shapeShiftSteps(letter, tier).map((s) =>
              s.example ? (
                <div key={s.position} className="shifter__example">
                  <span className="shifter__exlabel">{t(positionLabelKey(s.position))}</span>
                  <ArabicWord
                    word={s.example.word}
                    size="clamp(1.5rem, 5vw, 2.3rem)"
                    highlight={letterSpans(s.example.word.ar)
                      .filter((x) => sameLetter(x.base, letter))
                      .map((x) => x.index)}
                  />
                  <span className="shifter__exen">{s.example.word.en}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </ChallengeFrame>
    );
  }

  /* ----------------------------------------------------------- placement game */
  const slots: ('start' | 'middle' | 'end')[] = ['start', 'middle', 'end'];

  return (
    <ChallengeFrame
      prompt={t('q.shapeShiftStep', {
        letter,
        where: t(positionLabelKey(step.position)),
      })}
      sub={t('q.shapeShiftIntro', { letter })}
      footer={
        <div className="resultbar">
          {wrong && (
            <Feedback good={false}>
              {t('fb.wrongPos', { letter, where: t(positionLabelKey(step.position)) })}
            </Feedback>
          )}
          {solvedThisStep && !wrong && (
            <Feedback good>
              {t('fb.correctForm', {
                form: '',
                name: nameOf(t, letter),
                where: t(positionLabelKey(step.position)),
              })}
            </Feedback>
          )}
          {(solvedThisStep || wrong) && (
            <Button tone="gold" onClick={advance}>{t('btn.next')} ›</Button>
          )}
        </div>
      }
    >
      {/* The letter under the learner's control. */}
      <div className="shifter__stage">
        <div className="shifter__letter" key={morphKey}>
          <LetterForm
            char={letter}
            position={shown}
            className="hero-letter shifter__glyph"
          />
          {info && (
            <button
              type="button"
              className="shifter__speak"
              onClick={() => { if (!pronounce(info.nameAr)) playSfx('click'); }}
              aria-label={t('btn.listen')}
            >
              🔊
            </button>
          )}
        </div>
        <p className="shifter__now">{t(positionLabelKey(shown))}</p>
      </div>

      {/* The three places in a word the letter can be dropped into. */}
      <div className="shifter__slots" dir={t.rtl ? 'rtl' : 'ltr'}>
        {slots.map((s) => {
          const isTarget = SLOT_FOR[step.position] === s;
          const state = solvedThisStep && isTarget ? 'is-filled'
            : wrong === s ? 'is-wrong'
            : wrong && isTarget ? 'is-hint'
            : '';
          return (
            <button
              key={s}
              type="button"
              className={`shifter__slot ${state}`}
              disabled={!!wrong || !!solvedThisStep}
              onClick={() => choose(s)}
            >
              <span className="shifter__slotglyph">
                {solvedThisStep && isTarget
                  ? <LetterForm char={letter} position={step.position} />
                  : <span aria-hidden="true">◌</span>}
              </span>
              <span className="shifter__slotlabel">{t(`slot.${s}`)}</span>
            </button>
          );
        })}
      </div>

      {solvedThisStep && step.example && (
        <div className="shifter__proof anim-rise">
          <span className="shifter__prooflabel">{t('disc.inWords')}</span>
          <ArabicWord
            word={step.example.word}
            size="clamp(1.9rem, 6.5vw, 2.9rem)"
            highlight={letterSpans(step.example.word.ar)
              .filter((x) => sameLetter(x.base, letter))
              .map((x) => x.index)}
          />
          <span className="shifter__proofen">
            {save.settings.transliteration && <i>{step.example.word.translit} · </i>}
            {step.example.word.en}
          </span>
        </div>
      )}

      {info && (
        <p className="shifter__hint">
          <ArabicSpan>{letter}</ArabicSpan>{' '}
          {positions.length > 2
            ? t('disc.fourForms', { name: nameOf(t, letter) })
            : t('disc.twoForms', { name: nameOf(t, letter) })}
        </p>
      )}
    </ChallengeFrame>
  );
}
