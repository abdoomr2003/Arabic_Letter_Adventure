import { useDispatch, useGame } from '../game/state';
import { playSfx } from '../game/audio';

/**
 * العربية | English
 *
 * Switching flips the whole interface between RTL and LTR.  The Arabic letters
 * and words themselves are never translated or replaced — only the scaffolding
 * around them changes.
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { save } = useGame();
  const dispatch = useDispatch();
  const lang = save.settings.lang;

  const set = (v: 'ar' | 'en') => {
    if (v === lang) return;
    playSfx('click');
    dispatch({ type: 'setSetting', key: 'lang', value: v });
  };

  return (
    <div className={`langtoggle ${compact ? 'langtoggle--compact' : ''}`} role="group" aria-label="Language / اللغة">
      <button
        type="button"
        className={`langtoggle__btn ${lang === 'ar' ? 'is-on' : ''}`}
        aria-pressed={lang === 'ar'}
        onClick={() => set('ar')}
        lang="ar"
      >
        العربية
      </button>
      <span className="langtoggle__sep" aria-hidden="true">|</span>
      <button
        type="button"
        className={`langtoggle__btn ${lang === 'en' ? 'is-on' : ''}`}
        aria-pressed={lang === 'en'}
        onClick={() => set('en')}
        lang="en"
      >
        English
      </button>
    </div>
  );
}
