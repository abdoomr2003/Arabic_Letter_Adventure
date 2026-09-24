import { useLayoutEffect, useRef, useState } from 'react';
import { letterSpans, shapeForm, type Position } from '../game/arabic';
import type { Word } from '../data/words';

/**
 * Arabic renderers.
 *
 * The rule everywhere below: a word is always rendered as ONE text node so the
 * browser's shaping engine joins it correctly.  When individual letters need to
 * be highlighted or tapped, their boxes are measured with DOM Ranges and overlaid
 * — the text itself is never split into per-letter elements, because that would
 * break the joining the game is trying to teach.
 */

export function ArabicSpan({
  children, className = '', style,
}: { children: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span lang="ar" dir="rtl" className={`font-arabic ${className}`} style={style}>
      {children}
    </span>
  );
}

/** One contextual form of a letter, produced by real Unicode joining control. */
export function LetterForm({
  char, position, className = '', style,
}: { char: string; position: Position; className?: string; style?: React.CSSProperties }) {
  return (
    <ArabicSpan className={className} style={style}>
      {shapeForm(char, position)}
    </ArabicSpan>
  );
}

interface LetterBox { index: number; base: string; left: number; top: number; width: number; height: number }

/** Measure the on-screen box of every letter of a rendered Arabic word. */
function useLetterBoxes(
  containerRef: React.RefObject<HTMLElement>,
  text: string,
): LetterBox[] {
  const [boxes, setBoxes] = useState<LetterBox[]>([]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const node = el.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const host = el.getBoundingClientRect();
      const next: LetterBox[] = [];
      for (const span of letterSpans(text)) {
        try {
          const range = document.createRange();
          range.setStart(node, span.start);
          range.setEnd(node, span.end);
          const rects = Array.from(range.getClientRects());
          if (!rects.length) continue;
          const left = Math.min(...rects.map((r) => r.left));
          const right = Math.max(...rects.map((r) => r.right));
          const top = Math.min(...rects.map((r) => r.top));
          const bottom = Math.max(...rects.map((r) => r.bottom));
          next.push({
            index: span.index,
            base: span.base,
            left: left - host.left,
            top: top - host.top,
            width: Math.max(right - left, 10),
            height: Math.max(bottom - top, 10),
          });
        } catch {
          /* a range that cannot be measured is simply not overlaid */
        }
      }
      setBoxes(next);
    };

    measure();
    // Fonts load asynchronously; re-measure once they are ready and on resize.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    let cancelled = false;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => { cancelled = true; ro.disconnect(); };
  }, [containerRef, text]);

  return boxes;
}

export interface ArabicWordProps {
  word: Word | string;
  /** Font size for the word, any CSS length. */
  size?: string;
  /** Letter indices to highlight. */
  highlight?: number[];
  /** Style of the highlight. */
  highlightTone?: 'target' | 'good' | 'bad';
  /** When set, every letter becomes a button. */
  onLetterTap?: (index: number, base: string) => void;
  /** Letters already answered — drawn as resolved and not tappable again. */
  resolved?: { index: number; correct: boolean }[];
  className?: string;
  ariaLabel?: string;
}

export function ArabicWord({
  word, size = 'clamp(2.6rem, 9vw, 4.4rem)', highlight = [], highlightTone = 'target',
  onLetterTap, resolved = [], className = '', ariaLabel,
}: ArabicWordProps) {
  const text = typeof word === 'string' ? word : word.ar;
  const ref = useRef<HTMLSpanElement>(null);
  const boxes = useLetterBoxes(ref, text);
  const resolvedMap = new Map(resolved.map((r) => [r.index, r.correct]));

  return (
    <span className={`aword ${className}`}>
      <span
        ref={ref}
        lang="ar"
        dir="rtl"
        className="aword__text font-arabic"
        style={{ fontSize: size }}
        aria-label={ariaLabel}
      >
        {text}
      </span>

      <span className="aword__overlay" aria-hidden={!onLetterTap}>
        {boxes.map((b) => {
          const state = resolvedMap.get(b.index);
          const isHot = highlight.includes(b.index);
          const cls = [
            'aword__cell',
            isHot ? `aword__cell--hl aword__cell--${highlightTone}` : '',
            state === true ? 'aword__cell--good' : '',
            state === false ? 'aword__cell--bad' : '',
          ].filter(Boolean).join(' ');
          const style: React.CSSProperties = {
            left: b.left, top: b.top, width: b.width, height: b.height,
          };
          if (!onLetterTap) return <span key={b.index} className={cls} style={style} />;
          return (
            <button
              key={b.index}
              type="button"
              className={`${cls} aword__cell--tap`}
              style={style}
              disabled={state !== undefined}
              onClick={() => onLetterTap(b.index, b.base)}
              aria-label={`${b.base}`}
            />
          );
        })}
      </span>
    </span>
  );
}

/**
 * The transformation strip: ب → بـ → ـبـ → ـب.
 * `active` drives which step is lit, so the caller can animate it.
 */
export function FormStrip({
  char, forms, active, onPick, size = 'clamp(2rem, 6vw, 3rem)', labels,
}: {
  char: string;
  forms: Position[];
  active?: number;
  onPick?: (i: number) => void;
  size?: string;
  labels?: string[];
}) {
  return (
    // Arabic is written right-to-left, so the chain starts at the right (ب) and
    // the arrows point left — in both UI languages.
    <ol className="formstrip" dir="rtl">
      {forms.map((p, i) => (
        <li key={p} className="formstrip__item">
          {i > 0 && <span className="formstrip__arrow" aria-hidden="true">←</span>}
          {onPick ? (
            <button
              type="button"
              className={`formstrip__chip ${active === i ? 'is-active' : ''}`}
              onClick={() => onPick(i)}
              aria-pressed={active === i}
            >
              <LetterForm char={char} position={p} style={{ fontSize: size }} />
              {labels?.[i] && <span className="formstrip__label">{labels[i]}</span>}
            </button>
          ) : (
            <span className={`formstrip__chip ${active === i ? 'is-active' : ''}`}>
              <LetterForm char={char} position={p} style={{ fontSize: size }} />
              {labels?.[i] && <span className="formstrip__label">{labels[i]}</span>}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const ARABIC_RUN = /([؀-ۿݐ-ݿ‍ً-ْ]+)/g;

/**
 * Mixed Arabic/English text, done properly.
 *
 * A sentence like `Find the letter ب` puts an Arabic run inside an English one.
 * Left as a plain string the bidi algorithm can reorder the neighbouring words,
 * and the letter renders at body size in the UI font, where a bare ا is easy to
 * mistake for a Latin "l".  Each Arabic run is therefore isolated with <bdi> and
 * given the Arabic face at a slightly larger size, so the letter stays the thing
 * the eye lands on.
 */
export function RichText({ children, className = '' }: { children: string; className?: string }) {
  const parts = children.split(ARABIC_RUN);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <bdi key={i} lang="ar" dir="rtl" className="inline-arabic">{part}</bdi>
          : <span key={i}>{part}</span>,
      )}
    </span>
  );
}
