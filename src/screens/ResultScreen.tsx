import { useEffect } from 'react';
import { useDispatch, useGame, nextLevelId } from '../game/state';
import { LEVEL_BY_ID } from '../data/levels';
import { WORLD_BY_ID } from '../data/worlds';
import { letterByChar } from '../data/letters';
import { availablePositions } from '../game/arabic';
import { playSfx } from '../game/audio';
import { ArabicSpan, FormStrip, RichText } from '../components/Arabic';
import { Button, Confetti, CountUp, Panel, Stars, useT } from '../components/ui';
import { positionLabelKey } from '../game/questions';

/**
 * Level complete — the shield-and-ribbon celebration from the design.
 *
 * Every figure on it is the real result of the run that just happened: stars come
 * from accuracy and hearts, coins and XP come from the star grade, and the unlock
 * list is the difference between what was open before the level and after it.
 */
export function ResultScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { outcome, save } = useGame();

  useEffect(() => { playSfx('win'); }, []);

  if (!outcome) return null;
  const level = LEVEL_BY_ID.get(outcome.levelId);
  if (!level) return null;

  const letter = level.targetLetters[0];
  const info = letterByChar(letter);
  const forms = availablePositions(letter);
  const next = nextLevelId(level.id);
  const nextLevel = next ? LEVEL_BY_ID.get(next) : undefined;

  return (
    <div className="result">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-victory.jpg)' }} />
      <Confetti seed={outcome.score + 1} />

      <div className="scroll">
        <div className="result__inner">
          <div className="result__shield anim-pop">
            <h1 className="result__title">
              🎉 {level.kind === 'boss' ? t('boss.defeated') : t('res.complete')}
            </h1>

            <Stars n={outcome.stars} size="clamp(2.4rem, 9vw, 3.6rem)" />

            <p className="result__score">
              <span className="result__scorenum"><CountUp value={outcome.score} /></span>
              <span className="result__scorelabel">{t('res.score')}</span>
            </p>

            <div className="result__ribbon">{t('res.levelComplete')}</div>
          </div>

          {/* ——— what the run actually produced ——— */}
          <Panel variant="glass" className="result__stats">
            <Stat label={t('res.coins')} icon="🪙" value={outcome.coins} />
            <Stat label={t('res.xp')} icon="✨" value={outcome.xp} />
            <Stat label={t('res.accuracy')} icon="🎯" value={`${Math.round(outcome.accuracy * 100)}%`} />
            <Stat label={t('res.bestCombo')} icon="🔥" value={`×${outcome.bestCombo}`} />
            <Stat label={t('res.mistakes')} icon="💡" value={outcome.mistakes} />
          </Panel>

          {/* ——— what was learned ——— */}
          {level.kind === 'letter' && info && (
            <Panel variant="glass" className="result__learned">
              <p className="result__learnedtext">
                <RichText>
                  {forms.length > 1
                    ? t('res.learned', { letter })
                    : t('res.learnedOne', { letter })}
                </RichText>
              </p>
              {forms.length > 1 && (
                <FormStrip
                  char={letter}
                  forms={forms}
                  size="clamp(1.6rem, 5.5vw, 2.4rem)"
                  labels={forms.map((p) => t(positionLabelKey(p)))}
                />
              )}
            </Panel>
          )}

          {/* ——— unlocks ——— */}
          {(outcome.unlocks.worlds.length > 0 || outcome.unlocks.badges.length > 0) && (
            <Panel className="result__unlocks anim-rise">
              <h2 className="result__unlockstitle">🎁 {t('res.unlocked')}</h2>
              <ul className="result__unlocklist">
                {outcome.unlocks.worlds.map((w) => (
                  <li key={w.id} className="result__unlock">
                    <span aria-hidden="true">{w.icon}</span>
                    {t('res.unlockedWorld', { name: t.lang === 'ar' ? w.nameAr : w.nameEn })}
                  </li>
                ))}
                {outcome.unlocks.badges.map((b) => (
                  <li key={b.id} className="result__unlock">
                    <span aria-hidden="true">{b.icon}</span>
                    {t('reward.badge')} — {t.lang === 'ar' ? b.nameAr : b.nameEn}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="result__actions">
            {next && (
              <Button
                tone="green"
                size="lg"
                onClick={() => dispatch({ type: 'startLevel', levelId: next })}
              >
                ▶ {t('btn.nextLevel')}
                {nextLevel && WORLD_BY_ID.get(nextLevel.worldId) && nextLevel.worldId !== level.worldId && (
                  <span className="tiny"> · {WORLD_BY_ID.get(nextLevel.worldId)!.icon}</span>
                )}
              </Button>
            )}
            <Button tone="ghost" onClick={() => dispatch({ type: 'startLevel', levelId: level.id })}>
              ↻ {t('btn.replay')}
            </Button>
            <Button tone="ghost" onClick={() => dispatch({ type: 'openWorld', worldId: level.worldId })}>
              🗺️ {t('btn.toMap')}
            </Button>
          </div>

          <p className="result__totals">
            🪙 <ArabicSpan>{''}</ArabicSpan>{save.progress.coins.toLocaleString()} · ✨ {save.progress.xp.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, icon, value }: { label: string; icon: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat__icon" aria-hidden="true">{icon}</span>
      <span className="stat__value">{typeof value === 'number' ? <CountUp value={value} /> : value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
