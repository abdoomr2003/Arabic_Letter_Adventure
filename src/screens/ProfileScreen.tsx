import { useCompleted, useDispatch, useGame } from '../game/state';
import { LEVELS, isWorldUnlocked, levelsOfWorld } from '../data/levels';
import { WORLDS } from '../data/worlds';
import { LETTERS, letterByChar } from '../data/letters';
import { BADGES, earnedBadges } from '../data/rewards';
import { masteredLetters, masteryOf, similarAccuracy, strugglingLetters } from '../game/adaptive';
import { playerLevel } from '../game/scoring';
import { availablePositions } from '../game/arabic';
import { ArabicSpan } from '../components/Arabic';
import { Banner, Button, Panel, ProgressBar, Stars, useT } from '../components/ui';

const AVATARS = ['🧑‍🚀', '🧙', '🦸', '🧝', '🐱', '🦉', '🐼', '🦊'];

/**
 * A game character sheet, not a school report: avatar, adventurer level, the
 * treasure you have gathered, and an honest picture of which letters you have
 * mastered and which still need work.  Every number is derived from real play.
 */
export function ProfileScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const { save } = useGame();
  const completed = useCompleted();
  const p = save.progress;

  const pl = playerLevel(p.xp);
  const mastered = masteredLetters(p);
  const struggling = strugglingLetters(p);
  const simAcc = similarAccuracy(p);
  const stars = Object.values(p.levels).reduce((n, r) => n + r.stars, 0);
  const badges = earnedBadges(p);

  // Contextual forms count as mastered when the letter itself is mastered.
  const formsMastered = mastered.reduce((n, ch) => n + availablePositions(ch).length, 0);
  const totalForms = LETTERS.reduce((n, l) => n + availablePositions(l.char).length, 0);

  const currentWorld = [...WORLDS].reverse().find((w) => isWorldUnlocked(w.id, completed)) ?? WORLDS[0];

  return (
    <div className="profile">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-champion.jpg)' }} />

      <header className="profile__top">
        <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'home' })}>
          ‹ {t('btn.back')}
        </Button>
        <Banner>{t('prof.title')}</Banner>
        <div className="hud__spacer" />
      </header>

      <div className="scroll">
        <div className="profile__inner">
          {/* ——— identity ——— */}
          <Panel variant="glass" className="profile__card">
            <div className="profile__avatarcol">
              <span className="profile__avatar" aria-hidden="true">{save.profile.avatar}</span>
              <div className="profile__avatars" role="group" aria-label={t('prof.title')}>
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`profile__avatarpick ${save.profile.avatar === a ? 'is-on' : ''}`}
                    onClick={() => dispatch({ type: 'setAvatar', avatar: a })}
                    aria-label={a}
                    aria-pressed={save.profile.avatar === a}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="profile__idcol">
              <label className="profile__namelabel" htmlFor="pname">{t('prof.nameLabel')}</label>
              <input
                id="pname"
                className="profile__name"
                value={save.profile.name}
                placeholder="…"
                maxLength={18}
                onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
              />
              <p className="profile__levelrow">
                <span className="chip chip--gold">{t('prof.level')} {pl.level}</span>
                <span className="chip">🪙 {p.coins.toLocaleString()}</span>
                <span className="chip">⭐ {stars}/{LEVELS.length * 3}</span>
              </p>
              <div className="profile__xp">
                <ProgressBar value={pl.into} max={pl.need} label={t('prof.xp')} />
                <span className="tiny muted">{pl.into} / {pl.need} {t('prof.xp')}</span>
              </div>
              <p className="profile__world">
                {t('prof.currentWorld')}: <b>{currentWorld.icon} {t.lang === 'ar' ? currentWorld.nameAr : currentWorld.nameEn}</b>
              </p>
            </div>
          </Panel>

          {/* ——— learning ——— */}
          <div className="profile__grid">
            <Panel variant="glass" className="profile__stat">
              <span className="profile__statnum">{mastered.length}<i>/{LETTERS.length}</i></span>
              <span className="profile__statlabel">{t('prof.lettersMastered')}</span>
            </Panel>
            <Panel variant="glass" className="profile__stat">
              <span className="profile__statnum">{formsMastered}<i>/{totalForms}</i></span>
              <span className="profile__statlabel">{t('prof.formsMastered')}</span>
            </Panel>
            <Panel variant="glass" className="profile__stat">
              <span className="profile__statnum">{p.wordsCompleted}</span>
              <span className="profile__statlabel">{t('prof.wordsDone')}</span>
            </Panel>
            <Panel variant="glass" className="profile__stat">
              <span className="profile__statnum">{simAcc === null ? '—' : `${Math.round(simAcc * 100)}%`}</span>
              <span className="profile__statlabel">{t('prof.similarAcc')}</span>
            </Panel>
            <Panel variant="glass" className="profile__stat">
              <span className="profile__statnum">×{p.bestCombo}</span>
              <span className="profile__statlabel">{t('prof.bestStreak')}</span>
            </Panel>
          </div>

          {/* ——— per-letter mastery ——— */}
          <Panel variant="glass" className="profile__letters">
            <h2 className="profile__h2">{t('map.letters')}</h2>
            <ul className="profile__lettergrid">
              {LETTERS.map((l) => {
                const m = masteryOf(p, l.char);
                const pct = Math.round(m.mastery * 100);
                return (
                  <li
                    key={l.id}
                    className={`profile__letter ${m.seen === 0 ? 'is-new' : pct >= 75 ? 'is-good' : pct >= 40 ? 'is-mid' : 'is-low'}`}
                    title={`${l.nameEn} — ${m.seen === 0 ? '—' : `${pct}%`}`}
                  >
                    <ArabicSpan className="profile__letterglyph">{l.char}</ArabicSpan>
                    <span className="profile__letterpct">{m.seen === 0 ? '·' : `${pct}%`}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {struggling.length > 0 && (
            <Panel className="profile__practice">
              <h2 className="profile__h2">💡 {t('prof.needsPractice')}</h2>
              <p className="profile__practicerow">
                {struggling.map((ch) => (
                  <span key={ch} className="chip chip--gold">
                    <ArabicSpan>{ch}</ArabicSpan> {letterByChar(ch)?.nameEn}
                  </span>
                ))}
              </p>
            </Panel>
          )}

          {/* ——— badges ——— */}
          <Panel variant="glass" className="profile__badges">
            <h2 className="profile__h2">{t('prof.badges')} · {badges.length}/{BADGES.length}</h2>
            <ul className="profile__badgegrid">
              {BADGES.map((b) => {
                const has = badges.some((x) => x.id === b.id);
                return (
                  <li key={b.id} className={`profile__badge ${has ? '' : 'is-locked'}`}>
                    <span className="profile__badgeicon" aria-hidden="true">{has ? b.icon : '🔒'}</span>
                    <span className="profile__badgename">{t.lang === 'ar' ? b.nameAr : b.nameEn}</span>
                    <span className="profile__badgedesc">{t.lang === 'ar' ? b.descAr : b.descEn}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* ——— worlds ——— */}
          <Panel variant="glass" className="profile__worlds">
            <h2 className="profile__h2">{t('map.title')}</h2>
            <ul className="profile__worldlist">
              {WORLDS.map((w) => {
                const lv = levelsOfWorld(w.id);
                const done = lv.filter((x) => completed.has(x.id)).length;
                const s = lv.reduce((n, x) => n + (p.levels[x.id]?.stars ?? 0), 0);
                return (
                  <li key={w.id} className="profile__worldrow">
                    <span aria-hidden="true">{isWorldUnlocked(w.id, completed) ? w.icon : '🔒'}</span>
                    <span className="grow">{t.lang === 'ar' ? w.nameAr : w.nameEn}</span>
                    <span className="tiny muted">{done}/{lv.length}</span>
                    <Stars n={Math.min(3, Math.round((s / (lv.length * 3)) * 3))} size="0.9em" />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
