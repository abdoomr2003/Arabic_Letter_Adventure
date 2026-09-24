import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDispatch } from '../game/state';
import { playSfx } from '../game/audio';
import { letterByChar } from '../data/letters';
import { shapeForm } from '../game/arabic';
import { positionLabelKey, slotLabelKey } from '../game/questions';
import { LetterForm, ArabicSpan, ArabicWord, RichText } from '../components/Arabic';
import { Button, Feedback, useSupport, useT } from '../components/ui';
import type { Option, Question } from '../game/types';

/* ------------------------------------------------------- answering plumbing */

export interface Answered { correct: boolean; option?: Option }

/**
 * Shared answer flow for every challenge: times the response, records it in the
 * game state (score, hearts, combo, per-letter mastery), plays the right sound,
 * and moves on — correct answers flow on by themselves, wrong ones wait so the
 * learner actually reads what the game is teaching them.
 */
export function useChallenge(question: Question, opts: { autoNextMs?: number; letterOf?: (o?: Option) => string } = {}) {
  const dispatch = useDispatch();
  const [result, setResult] = useState<Answered | null>(null);
  const started = useRef(performance.now());
  const advanced = useRef(false);

  // Clear the previous question's answer during render rather than in an effect,
  // so the incoming question is never drawn for a frame wearing the old result.
  const [resultFor, setResultFor] = useState(question.id);
  if (resultFor !== question.id) {
    setResultFor(question.id);
    setResult(null);
    started.current = performance.now();
    advanced.current = false;
  }

  const next = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    dispatch({ type: 'nextQuestion' });
  }, [dispatch]);

  const submit = useCallback((correct: boolean, option?: Option) => {
    if (result) return;
    const ms = performance.now() - started.current;
    setResult({ correct, option });
    dispatch({
      type: 'answer',
      correct,
      challenge: question.type,
      letter: question.targetLetter,
      ms,
      value: question.value,
    });
    playSfx(correct ? 'correct' : 'wrong');
  }, [dispatch, question, result]);

  // Correct answers carry on by themselves after a beat.
  useEffect(() => {
    if (!result?.correct) return;
    const delay = opts.autoNextMs ?? 1150;
    const id = window.setTimeout(next, delay);
    return () => window.clearTimeout(id);
  }, [result, next, opts.autoNextMs]);

  return { result, submit, next };
}

/* ------------------------------------------------------------- explanations */

/** Teaching feedback: never just "wrong", always "this is ت — look at the dots". */
export function useExplain() {
  const t = useT();
  return useCallback((question: Question, result: Answered): ReactNode => {
    if (result.correct) return t.msg(question.teachCorrect) || t('fb.correct');

    const chosen = result.option?.letter;
    if (chosen && chosen !== question.targetLetter) {
      const l = letterByChar(chosen);
      if (l) {
        const name = t.lang === 'ar' ? l.nameAr : l.nameEn;
        const hint = dotsPhrase(t, chosen) ?? '';
        return t('fb.wrongLetter', { name: `${name} (${chosen})`, hint });
      }
    }
    if (question.type === 'POSITION_DETECTION' && question.slot) {
      const slots = question.slots ?? [question.slot];
      return t('fb.wrongPos', {
        letter: question.targetLetter,
        where: slots.map((s) => t(slotLabelKey(s))).join(t.lang === 'ar' ? ' و' : ' and the '),
      });
    }
    if (question.type === 'CONTEXTUAL_FORM' && question.position) {
      return t('fb.correctForm', {
        form: shapeForm(question.targetLetter, question.position), name: nameOf(t, question.targetLetter), where: t(positionLabelKey(question.position)),
      });
    }
    return t('fb.wrongGeneric');
  }, [t]);
}

export function nameOf(t: ReturnType<typeof useT>, char: string): string {
  const l = letterByChar(char);
  if (!l) return char;
  return t.lang === 'ar' ? l.nameAr : l.nameEn;
}

/** "Look at the two dots above." — built from the letter's own data, not a string table of guesses. */
export function dotsPhrase(t: ReturnType<typeof useT>, char: string): string | null {
  const l = letterByChar(char);
  if (!l) return null;
  if (l.dots.count === 0 || l.dots.place === 'none') return t('fb.dots0');
  return t('fb.dots', { n: '', place: t(`dots.${l.dots.place}${l.dots.count}`) }).replace(/\s+/g, ' ');
}

/* --------------------------------------------------------------- rendering */

export function OptionContent({ option, size }: { option: Option; size?: string }) {
  const t = useT();
  const r = option.render;
  switch (r.kind) {
    case 'letter':
      return <ArabicSpan className="tile__glyph" style={size ? { fontSize: size } : undefined}>{r.char}</ArabicSpan>;
    case 'form':
      return <LetterForm char={r.char} position={r.position} className="tile__glyph" style={size ? { fontSize: size } : undefined} />;
    case 'word':
      return <ArabicWord word={r.word} size={size ?? 'clamp(1.6rem, 5vw, 2.4rem)'} />;
    case 'slot':
      return <span className="tile__label tile__label--big">{t(slotLabelKey(r.slot))}</span>;
    case 'position':
      return <span className="tile__label tile__label--big">{t(positionLabelKey(r.position))}</span>;
    case 'text':
      return <span className="tile__label tile__label--big">{t.lang === 'ar' ? r.ar : r.en}</span>;
  }
}

export function OptionTile({
  option, state, onPick, disabled, sublabel, size, pressed,
}: {
  option: Option;
  state?: 'correct' | 'wrong' | 'muted' | 'selected';
  onPick?: () => void;
  disabled?: boolean;
  sublabel?: string;
  size?: string;
  /** Present only when the tile acts as a multi-answer toggle. */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={['tile', state ? `tile--${state}` : '', disabled ? 'tile--done' : ''].filter(Boolean).join(' ')}
      onClick={onPick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      {state === 'correct' && <span className="tile__mark" aria-hidden="true">✓</span>}
      {state === 'wrong' && <span className="tile__mark" aria-hidden="true">✕</span>}
      <OptionContent option={option} size={size} />
      {sublabel && <span className="tile__label">{sublabel}</span>}
    </button>
  );
}

export function OptionGrid({
  options, result, onPick, columns, sublabelFor, size, selected,
}: {
  options: Option[];
  result: Answered | null;
  onPick: (o: Option) => void;
  columns?: number;
  sublabelFor?: (o: Option) => string | undefined;
  size?: string;
  /** Multi-answer mode: the options toggled on so far. */
  selected?: ReadonlySet<string>;
}) {
  return (
    <div
      className="optgrid stagger"
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        let state: 'correct' | 'wrong' | 'muted' | 'selected' | undefined;
        const picked = selected ? selected.has(o.id) : result?.option?.id === o.id;
        if (result) {
          if (o.correct) state = 'correct';
          else if (picked) state = 'wrong';
          else state = 'muted';
        } else if (picked) {
          state = 'selected';
        }
        return (
          <OptionTile
            key={o.id}
            option={o}
            state={state}
            pressed={selected ? selected.has(o.id) : undefined}
            size={size}
            sublabel={sublabelFor?.(o)}
            disabled={!!result}
            onPick={() => onPick(o)}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- frame + foot */

export function ChallengeFrame({
  prompt, sub, children, footer, aside,
}: { prompt: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="challenge">
      <header className="challenge__head">
        <h2 className="challenge__prompt">
          {typeof prompt === 'string' ? <RichText>{prompt}</RichText> : prompt}
        </h2>
        {sub && (
          <p className="challenge__sub">
            {typeof sub === 'string' ? <RichText>{sub}</RichText> : sub}
          </p>
        )}
      </header>
      {aside}
      <div className="challenge__body">{children}</div>
      <footer className="challenge__foot">{footer}</footer>
    </div>
  );
}

/** The feedback strip plus, for a wrong answer, the button that moves on. */
export function ResultBar({
  question, result, onNext,
}: { question: Question; result: Answered | null; onNext: () => void }) {
  const t = useT();
  const explain = useExplain();
  if (!result) return null;
  return (
    <div className="resultbar">
      <Feedback good={result.correct}>{explain(question, result)}</Feedback>
      {!result.correct && (
        <Button tone="gold" onClick={onNext}>{t('btn.next')} ›</Button>
      )}
    </div>
  );
}

/** Shows the target letter beside the prompt so it is always the visual anchor. */
export function TargetBadge({ char }: { char: string }) {
  const t = useT();
  const l = letterByChar(char);
  const { showTranslit } = useSupport();
  return (
    <div className="targetbadge">
      <ArabicSpan className="targetbadge__glyph">{char}</ArabicSpan>
      {l && (
        <span className="targetbadge__meta">
          <b>{t.lang === 'ar' ? l.nameAr : l.nameEn}</b>
          {showTranslit && <span className="muted">{l.sound}</span>}
        </span>
      )}
    </div>
  );
}
