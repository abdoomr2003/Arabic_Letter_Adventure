import { useEffect } from 'react';
import { useDispatch } from '../game/state';
import type { BuiltPhase } from '../game/questions';
import type { LevelDef } from '../game/types';
import { playSfx } from '../game/audio';
import { ProgressBar, TimerChip, useCountdown, useT } from '../components/ui';
import { Mcq } from './Mcq';
import { ShapeMatch } from './ShapeMatch';
import { WordHunt } from './WordHunt';
import { WordBuild } from './WordBuild';
import { ShapeShifter } from './ShapeShifter';
import { LetterDiscovery } from './LetterDiscovery';
import { SecretLetterDuel } from './SecretLetterDuel';
import { ThreeWords } from './ThreeWords';

/**
 * The challenge engine.
 *
 * It knows nothing about any particular letter or level — it takes the phase the
 * session is currently on and renders the matching challenge.  Adding a challenge
 * type means adding one case here and one generator in game/questions.ts.
 */
export function Engine({
  phase, questionIndex, level,
}: { phase: BuiltPhase; questionIndex: number; level: LevelDef }) {
  const letter = level.targetLetters[0];

  switch (phase.type) {
    case 'LETTER_DISCOVERY':
      return <LetterDiscovery letter={letter} />;

    case 'SHAPE_SHIFTER':
      return <ShapeShifter letter={letter} />;

    case 'BOSS_SECRET_LETTER':
      return <SecretLetterDuel letters={level.targetLetters} />;

    case 'BOSS_THREE_WORDS':
      return <ThreeWords letters={level.targetLetters} seconds={phase.seconds ?? 45} />;

    case 'TIMED_RECOGNITION':
      return <TimedPhase phase={phase} questionIndex={questionIndex} />;

    default: {
      const question = phase.questions[questionIndex];
      if (!question) return null;
      switch (question.type) {
        case 'SHAPE_MATCH': return <ShapeMatch question={question} />;
        case 'WORD_HUNT': return <WordHunt question={question} />;
        case 'WORD_BUILD': return <WordBuild question={question} />;
        default: return <Mcq question={question} />;
      }
    }
  }
}

/**
 * The 30-second Letter Rush.  One clock runs across the whole phase: it counts
 * down in real time, drives the bar, and ends the phase at zero no matter how
 * many questions are left.
 */
function TimedPhase({ phase, questionIndex }: { phase: BuiltPhase; questionIndex: number }) {
  const t = useT();
  const dispatch = useDispatch();
  const total = phase.seconds ?? 30;
  const left = useCountdown(total, true, () => {
    playSfx('lose');
    dispatch({ type: 'phaseDone' });
  });

  // A short warning beep in the last few seconds — real feedback, not decoration.
  useEffect(() => {
    if (left > 0 && left <= 5) playSfx('tick');
  }, [Math.ceil(left)]); // eslint-disable-line react-hooks/exhaustive-deps

  const question = phase.questions[questionIndex];

  return (
    <div className="timedphase">
      <div className="timedphase__bar">
        <TimerChip left={left} total={total} />
        <div className="grow">
          <ProgressBar value={left} max={total} danger={left <= 10} label={t('fb.timeUp')} />
        </div>
        <span className="chip chip--gold">
          {questionIndex + 1}/{phase.questions.length}
        </span>
      </div>
      {question && <Mcq question={question} fast />}
    </div>
  );
}
