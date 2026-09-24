import { useEffect } from 'react';
import { useCurrentLevel, useDispatch, useGame } from '../game/state';
import { letterByChar } from '../data/letters';
import { availablePositions } from '../game/arabic';
import { playSfx } from '../game/audio';
import { formPlan, stepLabelKey } from '../game/questions';
import { FormStrip } from '../components/Arabic';
import { Button, Panel, useT } from '../components/ui';

/**
 * Running out of hearts pauses the adventure — it does not wipe anything.
 * Levels already completed, coins and XP all stay exactly as they were; only the
 * rewards for this attempt are not granted, because the attempt did not finish.
 */
export function FailScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { session } = useGame();
  const level = useCurrentLevel();

  useEffect(() => { playSfx('lose'); }, []);

  if (!level || !session) return null;
  const letter = level.targetLetters[0];
  const info = letterByChar(letter);
  const forms = availablePositions(letter);

  return (
    <div className="fail">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-duel.jpg)' }} />

      <div className="fail__card anim-pop">
        <span className="fail__icon" aria-hidden="true">💔</span>
        <h1 className="fail__title">{t('res.fail')}</h1>
        <p className="fail__hint">{t('res.failHint')}</p>

        <div className="fail__stats">
          <span className="chip">🎯 {session.correct}/{session.asked}</span>
          <span className="chip">🏆 {session.score.toLocaleString()}</span>
          <span className="chip">🔥 ×{session.bestCombo}</span>
        </div>

        {/* A last reminder of the thing being learned, before trying again. */}
        {info && forms.length > 1 && (
          <Panel variant="glass" className="fail__reminder">
            <p className="tiny dim">{t('disc.sameLetter')}</p>
            <FormStrip
              char={letter}
              forms={formPlan(letter).map((p) => p.position)}
              size="clamp(1.5rem, 5vw, 2.2rem)"
              labels={formPlan(letter).map((p) => t(stepLabelKey(p)))}
            />
          </Panel>
        )}

        <div className="fail__actions">
          <Button tone="green" size="lg" onClick={() => dispatch({ type: 'startLevel', levelId: level.id })}>
            ↻ {t('btn.retry')}
          </Button>
          <Button tone="ghost" onClick={() => dispatch({ type: 'openWorld', worldId: level.worldId })}>
            🗺️ {t('btn.toMap')}
          </Button>
        </div>
      </div>
    </div>
  );
}
