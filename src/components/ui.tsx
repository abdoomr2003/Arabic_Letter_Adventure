import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { translate } from '../data/i18n';
import { RichText } from './Arabic';
import { useGame } from '../game/state';
import { playSfx, unlockAudio } from '../game/audio';
import type { Lang, Msg } from '../game/types';

/* ------------------------------------------------------------------- i18n */

export function useT() {
  const { save } = useGame();
  const lang = save.settings.lang;
  return useMemo(() => {
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    t.lang = lang as Lang;
    t.rtl = lang === 'ar';
    t.msg = (m?: Msg) => (m ? translate(lang, m.key, m.vars) : '');
    return t;
  }, [lang]);
}

/**
 * What support material to show beside Arabic words.
 *
 * Transliteration and English meanings exist for learners who do not read
 * Arabic yet; in the Arabic interface the word carries itself, so they stay off.
 * The Arabic script is never replaced by either of them.
 */
export function useSupport() {
  const { save } = useGame();
  const en = save.settings.lang === 'en';
  return {
    showTranslit: en && save.settings.transliteration,
    showMeaning: en,
  };
}

/* ---------------------------------------------------------------- buttons */

type BtnTone = 'blue' | 'green' | 'gold' | 'red' | 'ghost';

export function Button({
  children, tone = 'blue', size, onClick, disabled, className = '', type = 'button',
  sfx = 'click', ...rest
}: {
  children: ReactNode;
  tone?: BtnTone;
  size?: 'sm' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  sfx?: 'click' | null;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        'btn',
        tone !== 'blue' ? `btn--${tone}` : '',
        size ? `btn--${size}` : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={() => {
        unlockAudio();
        if (sfx) playSfx(sfx);
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label, children, onClick, tone = 'ghost', className = '',
}: { label: string; children: ReactNode; onClick?: () => void; tone?: BtnTone; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn btn--icon ${tone !== 'blue' ? `btn--${tone}` : ''} ${className}`}
      onClick={() => { unlockAudio(); playSfx('click'); onClick?.(); }}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- panels */

export function Banner({
  children, tone = 'navy', className = '',
}: { children: ReactNode; tone?: 'navy' | 'gold'; className?: string }) {
  return (
    <div className={`banner ${tone === 'gold' ? 'banner--gold' : ''} ${className}`}>
      <span>{children}</span>
    </div>
  );
}

export function Panel({
  children, variant, className = '', style,
}: { children: ReactNode; variant?: 'glass' | 'plain'; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`panel ${variant ? `panel--${variant}` : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- HUD */

export function Hearts({ lives, max }: { lives: number; max: number }) {
  const t = useT();
  const prev = useRef(lives);
  const [breaking, setBreaking] = useState<number | null>(null);
  useEffect(() => {
    if (lives < prev.current) {
      setBreaking(lives);
      const id = window.setTimeout(() => setBreaking(null), 520);
      prev.current = lives;
      return () => window.clearTimeout(id);
    }
    prev.current = lives;
  }, [lives]);

  return (
    <div className="pill pill--hearts" role="status" aria-label={`${t('hud.lives')}: ${lives}/${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const alive = i < lives;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`heart ${alive ? '' : 'heart--lost'} ${breaking === i ? 'heart--breaking' : ''}`}
          >
            {alive ? '❤️' : '🖤'}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The player's avatar, drawn the same way everywhere: isolated from the
 * surrounding Arabic/English run (<bdi>) and in the colour-emoji face, so it
 * never reorders or changes glyph depending on the screen it sits on.
 */
export function Avatar({ className = '' }: { className?: string }) {
  const { save } = useGame();
  return <bdi className={`emoji ${className}`} aria-hidden="true">{save.profile.avatar}</bdi>;
}

export function Pill({
  icon, children, label, tone = 'gold',
}: { icon?: ReactNode; children: ReactNode; label?: string; tone?: 'gold' | 'plain' }) {
  return (
    <div className={`pill ${tone === 'plain' ? 'pill--plain' : ''}`} aria-label={label} role={label ? 'status' : undefined}>
      {icon && <span className="pill__icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

/** A number that rolls up to its new value instead of snapping. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString()}</>;
}

export function Stars({ n, max = 3, size = '1.4em' }: { n: number; max?: number; size?: string }) {
  return (
    <span className="stars" role="img" aria-label={`${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`star ${i < n ? '' : 'star--off'}`} style={{ fontSize: size }} aria-hidden="true">
          ⭐
        </span>
      ))}
    </span>
  );
}

export function ProgressBar({
  value, max, danger, label,
}: { value: number; max: number; danger?: boolean; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={`bar ${danger ? 'bar--danger' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Combo({ multiplier }: { multiplier: number }) {
  const t = useT();
  if (multiplier < 2) return null;
  return <div className="combo anim-pop">🔥 {t('hud.combo', { n: multiplier })}</div>;
}

/* --------------------------------------------------------------- feedback */

export function Feedback({
  good, children, icon,
}: { good: boolean; children: ReactNode; icon?: string }) {
  return (
    <div className={`feedback ${good ? 'feedback--good' : 'feedback--bad'} anim-pop`} role="status" aria-live="polite">
      <span className="feedback__icon" aria-hidden="true">{icon ?? (good ? '✅' : '💡')}</span>
      <span>{typeof children === 'string' ? <RichText>{children}</RichText> : children}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- toggles */

export function Switch({
  label, on, onToggle, hint,
}: { label: string; on: boolean; onToggle: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" className="switch" aria-pressed={on} onClick={() => { playSfx('click'); onToggle(!on); }}>
      <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
        <span>{label}</span>
        {hint && <span className="switch__state">{hint}</span>}
      </span>
      <span className="switch__track" aria-hidden="true"><span className="switch__knob" /></span>
    </button>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  title, children, onClose, footer,
}: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        ref={ref}
        className="panel modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title">{title}</h2>
        {children}
        {footer && <div className="row row--wrap" style={{ marginTop: 18, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- confetti */

const CONFETTI_COLORS = ['#ffd45c', '#6fe3ff', '#ff6b78', '#79e06a', '#b58cff', '#ffffff'];

export function Confetti({ count = 60, seed = 1 }: { count?: number; seed?: number }) {
  const bits = useMemo(() => {
    let s = seed >>> 0 || 7;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rnd() * 100,
      delay: rnd() * 2.2,
      dur: 2.4 + rnd() * 2.2,
      color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
      w: 6 + rnd() * 8,
      h: 10 + rnd() * 12,
    }));
  }, [count, seed]);

  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.id}
          className="confetti__bit"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.h,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ timer */

/**
 * A real countdown: it ticks in wall-clock time, survives re-renders, calls back
 * once at zero, and can be paused.
 */
export function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds);
  const endRef = useRef<number>(0);
  const endedRef = useRef(false);
  const cbRef = useRef(onEnd);
  cbRef.current = onEnd;

  useEffect(() => {
    setLeft(seconds);
    endedRef.current = false;
    endRef.current = performance.now() + seconds * 1000;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    endRef.current = performance.now() + left * 1000;
    let raf = 0;
    const tick = () => {
      const remain = Math.max(0, (endRef.current - performance.now()) / 1000);
      setLeft(remain);
      if (remain <= 0) {
        if (!endedRef.current) { endedRef.current = true; cbRef.current(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `left` is intentionally not a dependency: it would restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return left;
}

export function TimerChip({ left, total }: { left: number; total: number }) {
  const secs = Math.ceil(left);
  const urgent = left <= 5;
  return (
    <div className={`timer ${urgent ? 'timer--urgent' : ''}`} role="timer" aria-live="off">
      <span aria-hidden="true">⏱️</span>
      <span>{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</span>
      <span className="sr-only">{secs} / {total}</span>
    </div>
  );
}
