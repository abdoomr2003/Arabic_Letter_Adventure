import { useCompleted, useDispatch, useGame } from '../game/state';
import { WORLD_BY_ID } from '../data/worlds';
import { isLevelUnlocked, levelsOfWorld } from '../data/levels';
import { letterByChar } from '../data/letters';
import { availablePositions } from '../game/arabic';
import { ArabicSpan, LetterForm } from '../components/Arabic';
import { Banner, Button, Panel, Pill, Stars, useT } from '../components/ui';

/**
 * A world's level list, laid out as the design does it: the illustrated scene on
 * one side, the letters of this world on the other, and the call to enter.
 */
export function WorldScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { save, worldId } = useGame();
  const completed = useCompleted();

  const world = worldId ? WORLD_BY_ID.get(worldId) : null;
  if (!world) return null;
  const levels = levelsOfWorld(world.id);

  return (
    <div className="world" style={{ '--accent': world.accent, '--accent2': world.accent2 } as React.CSSProperties}>
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: `url(./art/${world.art}.jpg)` }} />

      <header className="world__top">
        <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'map' })}>
          ‹ {t('btn.map')}
        </Button>
        <Banner>{world.icon} {t.lang === 'ar' ? world.nameAr : world.nameEn}</Banner>
        <div className="hud__spacer" />
        <Pill icon="💰">{save.progress.coins}</Pill>
      </header>

      <div className="scroll world__scroll">
        <div className="world__split">
          {/* ——— the illustrated scene ——— */}
          <figure className="world__scene">
            <img src={`./art/${world.art}.jpg`} alt="" />
            {world.guardian && (
              <img className="world__guardian anim-bob" src={`./art/${world.guardian}.jpg`} alt="" />
            )}
            <figcaption>
              <strong>{t.lang === 'ar' ? world.taglineAr : world.taglineEn}</strong>
              <span>{t.lang === 'ar' ? world.hintAr : world.hintEn}</span>
            </figcaption>
          </figure>

          {/* ——— the levels ——— */}
          <div className="world__levels">
            {levels.map((level) => {
              const unlocked = isLevelUnlocked(level.id, completed);
              const rec = save.progress.levels[level.id];
              const letter = level.targetLetters[0];
              const info = letterByChar(letter);
              const forms = level.kind === 'letter' ? availablePositions(letter) : [];

              return (
                <Panel
                  key={level.id}
                  variant={unlocked ? 'glass' : 'plain'}
                  className={`lvl ${unlocked ? '' : 'lvl--locked'} ${level.kind === 'boss' ? 'lvl--boss' : ''}`}
                >
                  <div className="lvl__glyph">
                    {level.kind === 'boss'
                      ? <span className="lvl__bossicon" aria-hidden="true">⚔️</span>
                      : <ArabicSpan className="hero-letter">{letter}</ArabicSpan>}
                  </div>

                  <div className="lvl__body">
                    <h3 className="lvl__title">
                      {t('level.label', { n: level.index })} ·{' '}
                      {level.kind === 'boss'
                        ? t('level.boss')
                        : t.lang === 'ar' ? info?.nameAr : info?.nameEn}
                    </h3>

                    {level.kind === 'letter' && info && (
                      <p className="lvl__meta">
                        <span className="chip chip--cyan">{info.sound}</span>
                        <span className="chip">{t('disc.formsCount', { n: forms.length })}</span>
                      </p>
                    )}
                    {level.kind === 'boss' && (
                      <p className="lvl__meta">
                        <span className="chip chip--gold">{t('boss.threeWords')}</span>
                      </p>
                    )}

                    {level.kind === 'letter' && forms.length > 1 && (
                      <p className="lvl__forms" dir="rtl" aria-hidden="true">
                        {forms.map((p, i) => (
                          <span key={p}>
                            {i > 0 && <i className="lvl__arrow">←</i>}
                            <LetterForm char={letter} position={p} />
                          </span>
                        ))}
                      </p>
                    )}

                    <div className="lvl__foot">
                      <Stars n={rec?.stars ?? 0} size="1.1em" />
                      {rec?.bestScore ? <span className="chip">{rec.bestScore.toLocaleString()}</span> : null}
                    </div>
                  </div>

                  <div className="lvl__action">
                    {unlocked ? (
                      <Button
                        tone={level.kind === 'boss' ? 'gold' : 'green'}
                        onClick={() => dispatch({ type: 'startLevel', levelId: level.id })}
                      >
                        {rec?.completed ? `↻ ${t('btn.replay')}` : `▶ ${level.kind === 'boss' ? t('btn.play') : t('btn.discover')}`}
                      </Button>
                    ) : (
                      <span className="lvl__lock" title={t('level.locked')}>
                        🔒 <span className="tiny">{t('map.locked')}</span>
                      </span>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
