import { useDispatch, useGame, useCompleted } from '../game/state';
import { LEVELS, LEVEL_ORDER, isLevelUnlocked } from '../data/levels';
import { playerLevel } from '../game/scoring';
import { Button, Pill, Stars, useT } from '../components/ui';
import { translate } from '../data/i18n';
import { ArabicSpan } from '../components/Arabic';
import { LanguageToggle } from './LanguageToggle';

/**
 * Home — the title screen from the design: the adventure landscape, the game's
 * name, one big call to action, and the crown/score badge in the corner.
 */
export function HomeScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { save } = useGame();
  const completed = useCompleted();

  const started = completed.size > 0;
  const nextLevel = LEVEL_ORDER.find((id) => !completed.has(id) && isLevelUnlocked(id, completed))
    ?? LEVEL_ORDER[0];
  const stars = Object.values(save.progress.levels).reduce((n, r) => n + r.stars, 0);
  const maxStars = LEVELS.length * 3;
  const pl = playerLevel(save.progress.xp);

  return (
    <div className="home">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-home.jpg)' }} />

      <header className="home__top">
        <LanguageToggle />
        <div className="hud__spacer" />
        <Pill icon="👑" label={t('res.score')}>{save.progress.totalScore.toLocaleString()}</Pill>
        <Pill icon="⭐" label={t('res.score')}>{stars}/{maxStars}</Pill>
      </header>

      <main className="home__main">
        <img className="home__hero anim-bob" src="./art/char-jeem.jpg" alt="" />

        <h1 className="home__title">
          <span className="home__titleicon" aria-hidden="true">🎮</span>
          <ArabicSpan className="home__titlear">مغامرة تحدي الحروف</ArabicSpan>
          <span className="home__titleen shimmer">{translate('en', 'app.title')}</span>
        </h1>
        <p className="home__sub">{t('app.subtitle')}</p>

        <div className="home__forms" aria-hidden="true">
          <span>ب</span><span>→</span><span>بـ</span><span>→</span><span>ـبـ</span><span>→</span><span>ـب</span>
        </div>

        <div className="home__cta">
          <Button
            tone="green"
            size="lg"
            onClick={() =>
              started
                ? dispatch({ type: 'setScreen', screen: 'map' })
                : dispatch({ type: 'startLevel', levelId: nextLevel })
            }
          >
            ▶ {started ? t('btn.continue') : t('btn.start')}
          </Button>
        </div>

        <nav className="home__nav">
          <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'map' })}>
            🗺️ {t('btn.map')}
          </Button>
          <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'profile' })}>
            {save.profile.avatar} {t('btn.profile')}
          </Button>
          <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'howto' })}>
            📖 {t('btn.howto')}
          </Button>
          <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'toggleSettings', open: true })}>
            ⚙️ {t('btn.settings')}
          </Button>
        </nav>

        {started && (
          <p className="home__progress">
            <span className="chip chip--gold">{t('prof.level')} {pl.level}</span>
            <Stars n={Math.min(3, Math.round((stars / maxStars) * 3))} />
            <span className="chip">🪙 {save.progress.coins}</span>
          </p>
        )}
      </main>
    </div>
  );
}
