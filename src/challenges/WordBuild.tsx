import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from '../game/state';
import { playSfx } from '../game/audio';
import { ArabicSpan, ArabicWord } from '../components/Arabic';
import { Button, useSupport, useT } from '../components/ui';
import { ChallengeFrame, ResultBar, useChallenge } from './kit';
import { analyzeWord, splitLetters, stripDiacritics } from '../game/arabic';
import { positionLabelKey } from '../game/questions';
import { makeRng, shuffle } from '../game/rng';
import type { Question } from '../game/types';

/**
 * GAME 6 — Build the Word.
 *
 * The learner is handed the letters on their own and puts them in order.  The
 * strip above updates as one joined text run after every placement, so the
 * letters visibly reach for each other and change shape — that is the lesson.
 * Arabic reads right to left, so the first letter placed sits on the right.
 */
export function WordBuild({ question }: { question: Question }) {
  const t = useT();
  const dispatch = useDispatch();
  const { showTranslit, showMeaning } = useSupport();
  const { result, submit, next } = useChallenge(question, { autoNextMs: 2200 });
  const [placed, setPlaced] = useState<number[]>([]);

  const word = question.word;

  const pieces = useMemo(() => {
    if (!word) return [];
    const letters = splitLetters(word.ar).map((l, i) => ({ base: l.base, id: i }));
    return shuffle(makeRng(word.ar.length * 7919 + letters.length), letters);
  }, [word]);

  useEffect(() => { setPlaced([]); }, [question.id]);

  if (!word) return null;

  const target = splitLetters(word.ar).map((l) => l.base);
  const built = placed.map((i) => pieces[i].base);
  const builtText = built.join('');
  const complete = built.length === target.length;

  const check = () => {
    const ok = built.join('') === target.join('');
    if (ok) {
      dispatch({ type: 'wordDone' });
      playSfx('reveal');
    }
    submit(ok, {
      id: 'build',
      render: { kind: 'word', word },
      correct: ok,
    });
  };

  const place = (idx: number) => {
    if (result || placed.includes(idx)) return;
    playSfx('click');
    setPlaced([...placed, idx]);
  };

  const unplace = (pos: number) => {
    if (result) return;
    playSfx('click');
    setPlaced(placed.filter((_, i) => i !== pos));
  };

  const analysedBuilt = analyzeWord(builtText);

  return (
    <ChallengeFrame
      prompt={t.msg(question.prompt)}
      sub={t.msg(question.subPrompt)}
      aside={
        // The word to build is named in the prompt; this is the picture cue and,
        // for learners reading the English interface, the meaning.
        <div className="build__goal">
          {word.emoji && <span className="build__emoji" aria-hidden="true">{word.emoji}</span>}
          <div className="build__model">
            <ArabicWord word={word} size="clamp(1.5rem, 5vw, 2.2rem)" />
          </div>
          {(showTranslit || showMeaning) && (
            <div className="col" style={{ gap: 2 }}>
              {showMeaning && <span className="build__en">{word.en}</span>}
              {showTranslit && <span className="build__translit">{word.translit}</span>}
            </div>
          )}
        </div>
      }
      footer={
        <>
          <div className="row" style={{ justifyContent: 'center' }}>
            {!result && (
              <Button tone="green" disabled={!complete} onClick={check}>
                {t('btn.confirm')}
              </Button>
            )}
          </div>
          <ResultBar question={question} result={result} onNext={next} />
        </>
      }
    >
      {/* The word under construction — one text run, so joining is real. */}
      <div className="build__strip" dir="rtl">
        <div className="build__slots">
          {Array.from({ length: target.length }, (_, i) => (
            <span key={i} className={`build__slot ${i < built.length ? 'is-filled' : ''}`} />
          ))}
        </div>
        <button
          type="button"
          className="build__joined"
          onClick={() => built.length && unplace(built.length - 1)}
          disabled={!!result || built.length === 0}
          aria-label={builtText || '—'}
        >
          <ArabicSpan className="hero-letter">{builtText || ' '}</ArabicSpan>
        </button>
        {builtText.length > 0 && (
          <p className="build__forms" dir="ltr">
            {analysedBuilt.map((l, i) => (
              <span key={i} className="build__formchip">
                <ArabicSpan>{l.base}</ArabicSpan>
                <span>{t(positionLabelKey(l.position))}</span>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="build__pieces">
        {pieces.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`tile tile--piece ${placed.includes(i) ? 'tile--muted' : ''}`}
            disabled={placed.includes(i) || !!result}
            onClick={() => place(i)}
          >
            <ArabicSpan className="tile__glyph">{p.base}</ArabicSpan>
          </button>
        ))}
      </div>

      {result && !result.correct && (
        <p className="challenge__note">
          {t('common.word')}: <ArabicSpan>{stripDiacritics(word.ar)}</ArabicSpan>
        </p>
      )}
    </ChallengeFrame>
  );
}
