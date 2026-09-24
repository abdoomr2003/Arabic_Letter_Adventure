import { useCompleted, useDispatch, useGame } from '../game/state';
import { WORLDS } from '../data/worlds';
import { isWorldUnlocked, levelsOfWorld } from '../data/levels';
import { ArabicSpan } from '../components/Arabic';
import { Banner, Button, Pill, ProgressBar, useT } from '../components/ui';

/**
 * The adventure map: seven island worlds along a winding road, each showing its
 * own artwork, its letters, and its true state — locked, open, completed or
 * perfect.  A locked world is genuinely locked: tapping it starts nothing.
 */
export function MapScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { save } = useGame();
  const completed = useCompleted();

  const unlockedWorlds = WORLDS.filter((w) => isWorldUnlocked(w.id, completed));
  // The "you are here" pin from the design: the furthest world still in progress.
  const currentWorldId = WORLDS.find(
    (w) => isWorldUnlocked(w.id, completed) && levelsOfWorld(w.id).some((l) => !completed.has(l.id)),
  )?.id;

  return (
    <div className="map">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-map.jpg)' }} />

      <header className="map__top">
        <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'home' })}>
          ‹ {t('btn.back')}
        </Button>
        <Banner>🗺️ {t('map.title')}</Banner>
        <div className="hud__spacer" />
        <Pill icon="💰">{save.progress.coins}</Pill>
        <Pill icon="⭐">
          {Object.values(save.progress.levels).reduce((n, r) => n + r.stars, 0)}
        </Pill>
      </header>

      <div className="scroll map__scroll">
        <ol className="map__road">
          {WORLDS.map((world, i) => {
            const levels = levelsOfWorld(world.id);
            const done = levels.filter((l) => completed.has(l.id)).length;
            const unlocked = isWorldUnlocked(world.id, completed);
            const allDone = done === levels.length;
            const stars = levels.reduce((n, l) => n + (save.progress.levels[l.id]?.stars ?? 0), 0);
            const perfect = allDone && stars === levels.length * 3;
            const prev = WORLDS[i - 1];

            const state = !unlocked ? 'locked' : perfect ? 'perfect' : allDone ? 'done' : 'open';
            const here = world.id === currentWorldId;
            const badge = { locked: '🔒', open: '✨', done: '🏆', perfect: '👑' }[state];

            return (
              <li key={world.id} className={`map__node map__node--${state} ${here ? 'map__node--here' : ''}`} style={{ '--accent': world.accent } as React.CSSProperties}>
                <button
                  type="button"
                  className="map__island"
                  disabled={!unlocked}
                  aria-label={`${t.lang === 'ar' ? world.nameAr : world.nameEn} — ${unlocked ? t('map.levels', { done, total: levels.length }) : t('map.locked')}`}
                  onClick={() => unlocked && dispatch({ type: 'openWorld', worldId: world.id })}
                >
                  <span className="map__num">{world.order}</span>
                  {here && <span className="map__here" aria-hidden="true">📍</span>}
                  <span className="map__badge" aria-hidden="true">{badge}</span>
                  <img className="map__art" src={`./art/${world.art}.jpg`} alt="" loading="lazy" />
                  {!unlocked && <span className="map__lock" aria-hidden="true">🔒</span>}
                </button>

                <div className="map__info">
                  <h3 className="map__name">{t.lang === 'ar' ? world.nameAr : world.nameEn}</h3>
                  <p className="map__letters" aria-hidden="true">
                    {world.letters.map((c) => (
                      <ArabicSpan key={c} className="map__letter">{c}</ArabicSpan>
                    ))}
                  </p>
                  {unlocked ? (
                    <>
                      <p className="map__count">{t('map.levels', { done, total: levels.length })}</p>
                      <div className="map__bar">
                        <ProgressBar value={done} max={levels.length} label={world.nameEn} />
                      </div>
                    </>
                  ) : (
                    <p className="map__locked">
                      🔒 {prev ? t('map.lockedHint', { prev: t.lang === 'ar' ? prev.nameAr : prev.nameEn }) : t('map.locked')}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="map__foot">
        <span className="map__progresstext">
          {t('map.progress', { done: unlockedWorlds.length, total: WORLDS.length })}
        </span>
        <div className="map__progressbar">
          <ProgressBar value={unlockedWorlds.length} max={WORLDS.length} label={t('map.progress', { done: unlockedWorlds.length, total: WORLDS.length })} />
        </div>
      </footer>
    </div>
  );
}
