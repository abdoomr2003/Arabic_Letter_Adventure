import { useState } from 'react';
import { ArabicWord } from '../components/Arabic';
import { useSupport, useT } from '../components/ui';
import { ChallengeFrame, ResultBar, TargetBadge, useChallenge } from './kit';
import { analyzeWord, letterSpans, sameLetter, shapeForm, slotOf } from '../game/arabic';
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
  const [tapsFor, setTapsFor] = useState(question.id);
  if (tapsFor !== question.id) {
    setTapsFor(question.id);
    setTaps([]);
  }

  const word = question.word;
  if (!word) return null;

  const analysed = analyzeWord(word.ar);
  const targets = letterSpans(word.ar)
    .filter((s) => sameLetter(s.base, question.targetLetter))
    .map((s) => s.index);

  // Every occurrence must be found: توت is only solved once both ت are tapped.
  const onTap = (index: number, base: string) => {
    if (result) return;
    // A re-tap on an already-found letter must not count twice.
    if (taps.some((x) => x.index === index && x.correct)) return;
    const correct = sameLetter(base, question.targetLetter);
    const nextTaps = [...taps, { index, correct }];
    setTaps(nextTaps);
    const option = { id: `w${index}`, render: { kind: 'letter', char: base } as const, correct, letter: base };
    if (!correct) {
      submit(false, option);
    } else if (nextTaps.filter((x) => x.correct).length >= targets.length) {
      submit(true, option);
    }
  };

  const found = taps.filter((x) => x.correct).length;
  // The per-form note only makes sense for a single occurrence; for several, teachCorrect lists them all.
  const soleTap = targets.length === 1 ? taps[0] : undefined;
  const hitPosition = result?.correct && soleTap
    ? analysed[soleTap.index]?.position
    : undefined;
  const hitSlot = soleTap ? slotOf(soleTap.index, analysed.length) : undefined;

  return (
    <ChallengeFrame
      prompt={t.msg(question.prompt)}
      sub={targets.length > 1
        ? t('q.huntCount', { found, total: targets.length })
        : t('disc.tapForms')}
      aside={<TargetBadge char={question.targetLetter} />}
      footer={
        <>
          <ResultBar question={question} result={result} onNext={next} />
          {result?.correct && hitPosition && hitSlot && (
            <p className="challenge__note">
              {t('fb.correctForm', {
                form: shapeForm(question.targetLetter, hitPosition),
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
