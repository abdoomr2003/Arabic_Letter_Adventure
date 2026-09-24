import { useState } from 'react';
import { ArabicWord, LetterForm } from '../components/Arabic';
import { Button, useT } from '../components/ui';
import { ChallengeFrame, OptionGrid, ResultBar, TargetBadge, useChallenge } from './kit';
import { letterSpans, sameLetter } from '../game/arabic';
import type { Option, Question } from '../game/types';

/**
 * GAME 1 / 2 / 3, the similar-letter round and the timed round all share one
 * shape: a prompt and a grid of options.  Usually exactly one is right; when
 * `need > 1` (the letter sits in two places, as in توت) the learner toggles
 * every right option and presses Check.  How an option draws itself comes from
 * its `render` descriptor, so adding a question type does not mean adding a screen.
 */
export function Mcq({ question, fast = false }: { question: Question; fast?: boolean }) {
  const t = useT();
  const { result, submit, next } = useChallenge(question, { autoNextMs: fast ? 700 : 1200 });
  const multi = question.need > 1;
  // Fresh selection per question: the parent mounts Mcq with key={question.id}.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = (o: Option) => {
    const nextSet = new Set(selected);
    if (nextSet.has(o.id)) nextSet.delete(o.id);
    else nextSet.add(o.id);
    setSelected(nextSet);
  };

  const check = () => {
    const picks = question.options.filter((o) => selected.has(o.id));
    const allRight = question.options.every((o) => o.correct === selected.has(o.id));
    submit(allRight, picks.find((o) => !o.correct));
  };

  const aside = (() => {
    // A word question: the word is the thing being read, shown big with the
    // target letter marked in place so the learner sees it *inside* the joining.
    if (question.word) {
      return (
        <div className="challenge__word">
          {question.word.emoji && (
            <span className="challenge__wordemoji" aria-hidden="true">{question.word.emoji}</span>
          )}
          <ArabicWord
            word={question.word}
            size="clamp(2.6rem, 10vw, 4.6rem)"
            highlight={letterSpans(question.word.ar)
              .filter((s) => sameLetter(s.base, question.targetLetter))
              .map((s) => s.index)}
          />
        </div>
      );
    }
    // "Where in a word is this shape used?" — the shape itself must be the hero.
    if (question.type === 'CONTEXTUAL_FORM' && question.position) {
      return (
        <div className="challenge__formhero">
          <LetterForm
            char={question.targetLetter}
            position={question.position}
            className="hero-letter"
            style={{ fontSize: 'clamp(3.4rem, 14vw, 6.5rem)' }}
          />
        </div>
      );
    }
    return <TargetBadge char={question.targetLetter} />;
  })();

  const bigText = question.options.some((o) => o.render.kind === 'slot' || o.render.kind === 'position');
  const columns = bigText
    ? Math.min(3, question.options.length)
    : question.options.length === 3 ? 3 : undefined;

  return (
    <ChallengeFrame
      prompt={t.msg(question.prompt)}
      sub={question.subPrompt ? t.msg(question.subPrompt) : undefined}
      aside={aside}
      footer={
        multi && !result ? (
          <div className="resultbar">
            <Button tone="gold" onClick={check} disabled={selected.size === 0}>
              {t('btn.check')} ✓
            </Button>
          </div>
        ) : (
          <ResultBar question={question} result={result} onNext={next} />
        )
      }
    >
      <OptionGrid
        options={question.options}
        result={result}
        columns={columns}
        selected={multi ? selected : undefined}
        onPick={(o) => (multi ? toggle(o) : submit(o.correct, o))}
      />
    </ChallengeFrame>
  );
}
