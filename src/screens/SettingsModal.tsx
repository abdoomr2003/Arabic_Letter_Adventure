import { useState } from 'react';
import { useDispatch, useGame } from '../game/state';
import { storageAvailable } from '../game/persistence';
import { canPronounce } from '../game/audio';
import { Button, Modal, Switch, useT } from '../components/ui';
import { LanguageToggle } from './LanguageToggle';

export function SettingsModal() {
  const t = useT();
  const dispatch = useDispatch();
  const { save } = useGame();
  const s = save.settings;
  const [confirming, setConfirming] = useState(false);

  const close = () => dispatch({ type: 'toggleSettings', open: false });
  const set = (key: keyof typeof s, value: boolean) =>
    dispatch({ type: 'setSetting', key, value });

  return (
    <Modal
      title={`⚙️ ${t('btn.settings')}`}
      onClose={close}
      footer={<Button tone="ghost" onClick={close}>{t('btn.close')}</Button>}
    >
      <div className="col">
        <div className="settings__lang">
          <span>{t('set.lang')}</span>
          <LanguageToggle compact />
        </div>

        <Switch label={`🔊 ${t('set.sound')}`} on={s.sound} onToggle={(v) => set('sound', v)} />
        <Switch label={`🍃 ${t('set.motion')}`} on={s.reducedMotion} onToggle={(v) => set('reducedMotion', v)} />
        <Switch
          label={`🔤 ${t('set.translit')}`}
          on={s.transliteration}
          onToggle={(v) => set('transliteration', v)}
        />
        <Switch label={`🌗 ${t('set.contrast')}`} on={s.highContrast} onToggle={(v) => set('highContrast', v)} />

        <p className="tiny muted settings__note">
          {canPronounce()
            ? (t.lang === 'ar' ? '🔊 نطق الحروف متاح على هذا الجهاز.' : '🔊 Letter pronunciation is available on this device.')
            : (t.lang === 'ar' ? '🔇 لا يوجد صوت عربي مثبت على هذا الجهاز، فلن تظهر أزرار النطق.' : '🔇 No Arabic voice is installed here, so the speaker buttons stay hidden.')}
        </p>
        {!storageAvailable && (
          <p className="tiny muted settings__note">
            {t.lang === 'ar' ? '⚠️ لا يمكن حفظ التقدم في هذا المتصفح.' : '⚠️ Progress cannot be saved in this browser.'}
          </p>
        )}

        <hr className="settings__rule" />

        {confirming ? (
          <div className="col">
            <p className="tiny">{t('set.resetConfirm')}</p>
            <div className="row">
              <Button
                tone="red"
                onClick={() => { dispatch({ type: 'resetProgress' }); setConfirming(false); close(); }}
              >
                {t('btn.resetProgress')}
              </Button>
              <Button tone="ghost" onClick={() => setConfirming(false)}>{t('btn.close')}</Button>
            </div>
          </div>
        ) : (
          <Button tone="ghost" size="sm" onClick={() => setConfirming(true)}>
            🗑️ {t('btn.resetProgress')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
