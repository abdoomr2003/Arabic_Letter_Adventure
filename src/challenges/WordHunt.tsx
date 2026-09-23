import { useEffect, useState } from 'react';
import { ArabicWord } from '../components/Arabic';
import { useSupport, useT } from '../components/ui';
import { ChallengeFrame, ResultBar, TargetBadge, useChallenge } from './kit';
import { analyzeWord, letterSpans, sameLetter, slotOf } from '../game/arabic';
import { positionLabelKey, slotLabelKey } from '../game/questions';
import { letterByChar } from '../data/letters';
import type { Question } from '../game/types';

/**
 * GAME 5 — Word Hunter.
 *
 * The learner taps the target letter *inside* a real, joined word.  The word is
 * a single shaped text run; the tap targets are measured over it, so what gets
 * tapped is exactly the glyph the learner sees, joined to its neighbours.
 */
export function WordHunt({ question }: { question: Question }) {
  const t = useT();
  const { showTranslit, showMeaning } = useSupport();
  const { result, submit, next } = useChallenge(question, { autoNextMs: 1400 });
  const [taps, setTaps] = useState<{ index: number; correct: boolean }[]>([]);

  useEffect(() => { setTaps([]); }, [question.id]);

  const word = question.word;
  if (!word) return null;

  const analysed = analyzeWord(word.ar);
  const targets = letterSpans(word.ar)
    .filter((s) => sameLetter(s.base, question.targetLetter))
    .map((s) => s.index);

  const onTap = (index: number, base: string) => {
    if (result) return;
    const correct = sameLetter(base, question.targetLetter);
    setTaps([{ index, correct }]);
    submit(correct, {
      id: `w${index}`,
      render: { kind: 'letter', char: base },
      correct,
      letter: base,
    });
  };

  const hitPosition = result?.correct && taps[0]
    ? analysed[taps[0].index]?.position
    : undefined;
  const hitSlot = taps[0] ? slotOf(taps[0].index, analysed.length) : undefined;

  return (
    <ChallengeFrame
      prompt={t.msg(question.prompt)}
      sub={t('disc.tapForms')}
      aside={<TargetBadge char={question.targetLetter} />}
      footer={
        <>
          <ResultBar question={question} result={result} onNext={next} />
          {result?.correct && hitPosition && hitSlot && (
            <p className="challenge__note">
              {t('fb.correctForm', {
                form: '',
                name: (t.lang === 'ar'
                  ? letterByChar(question.targetLetter)?.nameAr
                  : letterByChar(question.targetLetter)?.nameEn) ?? question.targetLetter,
                where: `${t(slotLabelKey(hitSlot))} · ${t(positionLabelKey(hitPosition))}`,
              })}
            </p>
          )}
        </>
      }
    >
      <div className="hunt">
        {word.emoji && <span className="hunt__emoji" aria-hidden="true">{word.emoji}</span>}
        <ArabicWord
          word={word}
          size="clamp(3rem, 13vw, 6rem)"
          onLetterTap={onTap}
          resolved={taps}
          highlight={result && !result.correct ? targets : []}
          highlightTone="good"
          ariaLabel={`${word.ar} — ${word.en}`}
        />
        {(showTranslit || showMeaning) && (
          <p className="hunt__meta">
            {showTranslit && <span className="hunt__translit">{word.translit}</span>}
            {showMeaning && <span className="hunt__en">{word.en}</span>}
          </p>
        )}
      </div>
    </ChallengeFrame>
  );
}
