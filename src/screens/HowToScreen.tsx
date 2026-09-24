import { useDispatch } from '../game/state';
import { WORLDS } from '../data/worlds';
import { ArabicSpan, FormStrip, RichText } from '../components/Arabic';
import { Banner, Button, Panel, useT } from '../components/ui';
import { formPlan, stepLabelKey } from '../game/questions';

/**
 * The rulebook page: the six steps of the Secret Letter Challenge and the seven
 * letter worlds, kept exactly as the design lays them out.
 */
export function HowToScreen() {
  const t = useT();
  const dispatch = useDispatch();
  const steps = ['howto.1', 'howto.2', 'howto.3', 'howto.4', 'howto.5', 'howto.6'];
  const icons = ['📜', '📝', '💭', '🏆', '💬', '🔀'];

  return (
    <div className="howto">
      <div className="backdrop backdrop--soft backdrop--scrim" style={{ backgroundImage: 'url(./art/bg-howto.jpg)' }} />

      <header className="howto__top">
        <Button tone="ghost" size="sm" onClick={() => dispatch({ type: 'setScreen', screen: 'home' })}>
          ‹ {t('btn.back')}
        </Button>
        <Banner tone="gold">🎮 {t('howto.title')}</Banner>
        <div className="hud__spacer" />
      </header>

      <div className="scroll">
        <div className="howto__inner">
          {/* ——— the six rules ——— */}
          <ol className="howto__steps">
            {steps.map((k, i) => (
              <li key={k} className="howto__step">
                <Panel variant="glass" className="howto__stepcard">
                  <span className="howto__stepicon" aria-hidden="true">{icons[i]}</span>
                  <span className="howto__stepnum">{i + 1}</span>
                  <span className="howto__steptext">{t(k)}</span>
                </Panel>
                {i < steps.length - 1 && <span className="howto__arrow" aria-hidden="true">➜</span>}
              </li>
            ))}
          </ol>

          {/* ——— the core idea ——— */}
          <Panel className="howto__idea">
            <h2 className="howto__h2">✨ {t('disc.sameLetter')}</h2>
            <FormStrip
              char="ب"
              forms={formPlan('ب').map((p) => p.position)}
              size="clamp(2rem, 7vw, 3.2rem)"
              labels={formPlan('ب').map((p) => t(stepLabelKey(p)))}
            />
            <p className="howto__ideatext">{t('disc.fourForms', { name: t.lang === 'ar' ? 'باء' : 'Baa' })}</p>
            <p className="howto__ideanote">
              <RichText>
                {t.lang === 'ar'
                  ? 'وليس كل حرف له أربعة أشكال: ا د ذ ر ز و لها شكلان فقط لأنها لا تتصل بما بعدها — تأتي في أول الكلمة ووسطها وآخرها، وشكلها المتصل بما قبلها يُستعمل في الوسط والآخر.'
                  : 'Not every letter has four shapes: ا د ذ ر ز و have only two, because they never join the letter after them — they still sit at the beginning, middle and end, using the joined shape in the middle and at the end.'}
              </RichText>
            </p>
            <FormStrip
              char="د"
              forms={formPlan('د').map((p) => p.position)}
              size="clamp(2rem, 7vw, 3.2rem)"
              labels={formPlan('د').map((p) => t(stepLabelKey(p)))}
            />
          </Panel>

          {/* ——— the seven worlds ——— */}
          <h2 className="howto__h2 howto__h2--center">🗺️ {t('howto.worlds')}</h2>
          <ul className="howto__worlds">
            {WORLDS.map((w) => (
              <li key={w.id} className="howto__world panel panel--glass">
                <span className="howto__worldicon" aria-hidden="true">{w.icon}</span>
                <span className="howto__worldname">{t.lang === 'ar' ? w.nameAr : w.nameEn}</span>
                <span className="howto__worldletters">
                  {w.letters.map((c) => <ArabicSpan key={c}>{c}</ArabicSpan>)}
                </span>
                <span className="howto__worldhint">{t.lang === 'ar' ? w.hintAr : w.hintEn}</span>
              </li>
            ))}
          </ul>

          <div className="howto__cta">
            <Button tone="green" size="lg" onClick={() => dispatch({ type: 'setScreen', screen: 'map' })}>
              🗺️ {t('btn.map')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
