import { useEffect, useState } from 'react';
import { useCurrentLevel, useDispatch } from '../game/state';
import { canPronounce, onVoicesReady, playSfx, pronounce } from '../game/audio';
import { ArabicSpan, ArabicWord, FormStrip, LetterForm, RichText } from '../components/Arabic';
import { Button, useSupport, useT } from '../components/ui';
import { availablePositions, letterSpans, sameLetter, shapeForm } from '../game/arabic';
import { formPlan, shapeShiftSteps, stepLabelKey } from '../game/questions';
import { letterByChar } from '../data/letters';
import { worldOf } from '../data/worlds';

/**
 * Letter Discovery — every new letter gets a proper introduction.
 *
 * The letter is the hero of the screen; name, sound and meaning support it from
 * underneath.  The contextual forms are then revealed one at a time, each landing
 * in a real word, so the discovery is "it changed because its position changed",
 * not a table to memorise.
 */
export function LetterDiscovery({ letter }: { letter: string }) {
  const t = useT();
  const dispatch = useDispatch();
  const { showTranslit, showMeaning } = useSupport();
  const level = useCurrentLevel();
  const l = letterByChar(letter);
  const world = worldOf(letter);
  const positions = availablePositions(letter);
  // Shapes in reading order, each tied to its place (ا: أول ← وسط ← آخر).
  const plan = formPlan(letter);
  const steps = shapeShiftSteps(letter, level?.tier ?? 'beginner');

  const [revealed, setRevealed] = useState(0);
  const [speakable, setSpeakable] = useState(canPronounce());

  useEffect(() => onVoicesReady(() => setSpeakable(canPronounce())), []);

  // Reveal the forms one by one — the moment the game is built around.
  useEffect(() => {
    if (revealed >= plan.length) return;
    const id = window.setTimeout(() => {
      setRevealed((n) => n + 1);
      playSfx('reveal');
    }, revealed === 0 ? 500 : 900);
    return () => window.clearTimeout(id);
  }, [revealed, plan.length]);

  if (!l) return null;

  const name = t.lang === 'ar' ? l.nameAr : l.nameEn;
  const formsDone = revealed >= plan.length;

  const say = (text: string) => {
    if (!pronounce(text)) playSfx('click');
  };

  return (
    <div className="discovery scroll">
      <div className="discovery__inner">
        {/* ——— the hero ——— */}
        <section className="discovery__hero">
          <div className="discovery__glyphwrap">
            <ArabicSpan className="hero-letter discovery__glyph">{letter}</ArabicSpan>
            {speakable && (
              <button
                type="button"
                className="discovery__speak"
                onClick={() => say(l.nameAr)}
                aria-label={`${t('btn.listen')}: ${name}`}
              >
                🔊
              </button>
            )}
          </div>
          <div className="discovery__ident">
            <h1 className="discovery__name">{name}</h1>
            <p className="discovery__sound">
              <span className="chip chip--cyan">{l.sound}</span>
              {showTranslit && <span className="chip">{l.translit}</span>}
            </p>
            <p className="discovery__hint">{t.lang === 'ar' ? l.soundHintAr : l.soundHintEn}</p>
            {world && (
              <p className="discovery__world">
                <span aria-hidden="true">{world.icon}</span>{' '}
                {t.lang === 'ar' ? world.nameAr : world.nameEn}
              </p>
            )}
          </div>
        </section>

        {/* ——— the transformation ——— */}
        <section className="discovery__forms panel panel--glass">
          <h2 className="discovery__h2">{t('disc.forms')}</h2>
          <FormStrip
            char={letter}
            forms={plan.slice(0, Math.max(1, revealed)).map((p) => p.position)}
            active={revealed - 1}
            size="clamp(2.2rem, 8vw, 3.6rem)"
            labels={plan.map((p) => t(stepLabelKey(p)))}
          />
          <p className="discovery__formnote">
            <RichText>
              {positions.length === 1
                ? t('disc.oneForm', { name })
                : positions.length === 2
                  ? t('disc.twoForms', { name, iso: shapeForm(letter, 'isolated'), fin: `ـ${letter}` })
                  : t('disc.fourForms', { name })}
            </RichText>
          </p>
          {formsDone && positions.length > 1 && (
            <p className="discovery__same anim-pop">✨ {t('disc.sameLetter')}</p>
          )}
        </section>

        {/* ——— the proof, in real words ——— */}
        <section className="discovery__words">
          <h2 className="discovery__h2">{t('disc.inWords')}</h2>
          <ul className="discovery__wordlist">
            {steps.map((s, i) =>
              s.example ? (
                <li
                  key={`${s.position}-${s.slot ?? ''}`}
                  className={`discovery__word ${revealed > i ? 'anim-rise' : 'is-hidden'}`}
                  dir="rtl"
                >
                  <span className="discovery__poslabel">{t(stepLabelKey(s))}</span>
                  <div className="discovery__wordmain">
                    {s.example.word.emoji && (
                      <span className="discovery__emoji" aria-hidden="true">{s.example.word.emoji}</span>
                    )}
                    <ArabicWord
                      word={s.example.word}
                      size="clamp(1.8rem, 6vw, 2.7rem)"
                      highlight={letterSpans(s.example.word.ar)
                        .filter((x) => sameLetter(x.base, letter))
                        .map((x) => x.index)}
                    />
                    {speakable && (
                      <button
                        type="button"
                        className="discovery__wordspeak"
                        onClick={() => say(s.example!.word.ar)}
                        aria-label={`${t('btn.listen')}: ${s.example.word.translit}`}
                      >
                        🔊
                      </button>
                    )}
                  </div>
                  {(showTranslit || showMeaning) && (
                    <span className="discovery__wordmeta">
                      {showTranslit && <i>{s.example.word.translit}</i>}
                      {showTranslit && showMeaning && ' · '}
                      {showMeaning && s.example.word.en}
                    </span>
                  )}
                  <span className="discovery__inline" aria-hidden="true">
                    <LetterForm char={letter} position={s.position} />
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        </section>

        <div className="discovery__cta">
          <Button tone="green" size="lg" onClick={() => dispatch({ type: 'phaseDone' })}>
            ▶ {t('disc.startPlaying')}
          </Button>
        </div>
      </div>
    </div>
  );
}
