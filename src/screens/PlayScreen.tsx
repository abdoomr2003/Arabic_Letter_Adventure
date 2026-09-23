import { useEffect } from 'react';
import {
  MAX_LIVES, answeredSoFar, currentPhase, totalQuestions, useCurrentLevel, useDispatch, useGame,
} from '../game/state';
import { WORLD_BY_ID } from '../data/worlds';
import { letterByChar } from '../data/letters';
import { comboMultiplier } from '../game/scoring';
import { Engine } from '../challenges/Engine';
import { Banner, Combo, Hearts, IconButton, Pill, ProgressBar, useT } from '../components/ui';

/**
 * The play screen: the illustrated world behind, the HUD on top, and whatever
 * challenge the session is currently on in the middle.  Every HUD value is read
 * straight from the live session — nothing here is decorative.
 */
export function PlayScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { session, save } = useGame();
  const level = useCurrentLevel();

  const world = level ? WORLD_BY_ID.get(level.worldId) : null;
  const phase = session ? currentPhase(session) : undefined;

  // Leaving with Escape returns to the world, it does not silently complete anything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'abandonLevel' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  if (!session || !level || !phase) return null;

  const letter = level.targetLetters[0];
  const info = letterByChar(letter);
  const total = totalQuestions(session);
  const at = answeredSoFar(session);

  return (
    <div
      className="play"
      style={{ '--accent': world?.accent ?? '#6f8cff', '--accent2': world?.accent2 ?? '#ffd166' } as React.CSSProperties}
    >
      <div
        className="backdrop backdrop--soft backdrop--scrim"
        style={{ backgroundImage: `url(./art/${world?.art ?? 'world-alif'}.jpg)` }}
      />

      <header className="play__hud hud">
        <IconButton label={t('btn.back')} onClick={() => dispatch({ type: 'abandonLevel' })}>‹</IconButton>
        <Banner className="play__banner">
          {t('level.label', { n: level.index })}
          {' · '}
          {level.kind === 'boss'
            ? t('level.boss')
            : (t.lang === 'ar' ? info?.nameAr : info?.nameEn) ?? letter}
        </Banner>
        <div className="hud__spacer" />
        <Combo multiplier={comboMultiplier(session.streak)} />
        <Pill icon="🏆" label={t('hud.score')}>{session.score.toLocaleString()}</Pill>
        <Pill icon="🪙" label={t('hud.coins')}>{save.progress.coins + session.coins}</Pill>
        <Hearts lives={session.lives} max={MAX_LIVES} />
        <IconButton label={t('btn.settings')} onClick={() => dispatch({ type: 'toggleSettings', open: true })}>⚙️</IconButton>
      </header>

      <div className="play__progress">
        <ProgressBar value={at} max={total} label={t('hud.question', { n: at + 1, total })} />
      </div>

      <main className="play__stage">
        <Engine phase={phase} questionIndex={session.questionIndex} level={level} />
      </main>
    </div>
  );
}
