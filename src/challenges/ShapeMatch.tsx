import { useEffect, useState } from 'react';
import { useDispatch } from '../game/state';
import { playSfx } from '../game/audio';
import { Button, Feedback, useT } from '../components/ui';
import { ChallengeFrame, OptionTile, TargetBadge, nameOf } from './kit';
import { positionLabelKey } from '../game/questions';
import type { Option, Question } from '../game/types';

/**
 * GAME 4 — Shape Matching.
 *
 * Collect every shape that belongs to the target letter and leave the impostors
 * alone.  It plays like a puzzle rather than a quiz: picks are made one at a
 * time, each one lands immediately, and a wrong pick teaches which letter it
 * really was before the round carries on.
 */
export function ShapeMatch({ question }: { question: Question }) {
  const t = useT();
  const dispatch = useDispatch();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [lastWrong, setLastWrong] = useState<Option | null>(null);
  const [startedAt] = useState(() => performance.now());

  const found = Object.entries(picked).filter(([, ok]) => ok).length;

  useEffect(() => { setPicked({}); setDone(false); setLastWrong(null); }, [question.id]);

  const pick = (o: Option) => {
    if (picked[o.id] !== undefined || done) return;
    const next = { ...picked, [o.id]: o.correct };
    setPicked(next);
    playSfx(o.correct ? 'correct' : 'wrong');
    if (!o.correct) setLastWrong(o);

    dispatch({
      type: 'answer',
      correct: o.correct,
      challenge: question.type,
      letter: question.targetLetter,
      ms: performance.now() - startedAt,
      value: Math.round(question.value / question.need),
    });

    const nowFound = Object.values(next).filter(Boolean).length;
    if (nowFound >= question.need) {
      setDone(true);
      playSfx('combo');
    }
  };

  return (
    <ChallengeFrame
      prompt={t.msg(question.prompt)}
      sub={t('disc.sameLetter')}
      aside={<TargetBadge char={question.targetLetter} />}
      footer={
        <div className="resultbar">
          {lastWrong && !done && (
            <Feedback good={false}>
              {t('fb.wrongForm', {
                name: nameOf(t, lastWrong.letter ?? ''),
                target: nameOf(t, question.targetLetter),
              })}
            </Feedback>
          )}
          {done && <Feedback good>{t('disc.sameLetter')}</Feedback>}
          {done && (
            <Button tone="green" onClick={() => dispatch({ type: 'nextQuestion' })}>
              {t('btn.next')} ›
            </Button>
          )}
        </div>
      }
    >
      <p className="challenge__counter" aria-live="polite">
        {found} / {question.need}
      </p>
      <div className="optgrid optgrid--dense stagger">
        {question.options.map((o) => {
          const state = picked[o.id] === undefined
            ? undefined
            : picked[o.id] ? 'correct' : 'wrong';
          return (
            <OptionTile
              key={o.id}
              option={o}
              state={state}
              disabled={picked[o.id] !== undefined || done}
              onPick={() => pick(o)}
              sublabel={
                state === 'correct' && o.render.kind === 'form'
                  ? t(positionLabelKey(o.render.position))
                  : undefined
              }
            />
          );
        })}
      </div>
    </ChallengeFrame>
  );
}
