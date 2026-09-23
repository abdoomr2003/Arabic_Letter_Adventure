import { WORLDS } from './worlds';
import { masteredLetters } from '../game/adaptive';
import type { Progress } from '../game/types';

export interface Badge {
  id: string;
  icon: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  earned: (p: Progress) => boolean;
}

const completed = (p: Progress) => Object.values(p.levels).filter((l) => l.completed).length;
const perfect = (p: Progress) => Object.values(p.levels).filter((l) => l.stars === 3).length;

export const BADGES: Badge[] = [
  {
    id: 'first-step', icon: '🥾',
    nameAr: 'أول خطوة', nameEn: 'First Step',
    descAr: 'أكملت أول مرحلة', descEn: 'Finished your first level',
    earned: (p) => completed(p) >= 1,
  },
  {
    id: 'shape-seer', icon: '🔀',
    nameAr: 'عين الأشكال', nameEn: 'Shape Seer',
    descAr: 'أكملت خمس مراحل', descEn: 'Finished five levels',
    earned: (p) => completed(p) >= 5,
  },
  {
    id: 'flawless', icon: '💎',
    nameAr: 'بلا خطأ', nameEn: 'Flawless',
    descAr: 'حصلت على ثلاث نجوم في مرحلة', descEn: 'Earned three stars in a level',
    earned: (p) => perfect(p) >= 1,
  },
  {
    id: 'combo-master', icon: '🔥',
    nameAr: 'سلسلة النار', nameEn: 'Combo Master',
    descAr: 'سلسلة من ١٠ إجابات صحيحة', descEn: 'A streak of 10 correct answers',
    earned: (p) => p.bestCombo >= 10,
  },
  {
    id: 'treasure', icon: '💰',
    nameAr: 'صائد الكنوز', nameEn: 'Treasure Hunter',
    descAr: 'جمعت ٥٠٠ قطعة ذهبية', descEn: 'Collected 500 coins',
    earned: (p) => p.coins >= 500,
  },
  {
    id: 'wordsmith', icon: '📜',
    nameAr: 'صانع الكلمات', nameEn: 'Wordsmith',
    descAr: 'أتممت ١٥ كلمة', descEn: 'Completed 15 words',
    earned: (p) => p.wordsCompleted >= 15,
  },
  {
    id: 'ten-letters', icon: '🔤',
    nameAr: 'عشرة حروف', nameEn: 'Ten Letters',
    descAr: 'أتقنت عشرة حروف', descEn: 'Mastered ten letters',
    earned: (p) => masteredLetters(p).length >= 10,
  },
  {
    id: 'alphabet', icon: '👑',
    nameAr: 'بطل الحروف', nameEn: 'Letter Champion',
    descAr: 'أتقنت كل الحروف', descEn: 'Mastered every letter',
    earned: (p) => masteredLetters(p).length >= 28,
  },
  ...WORLDS.map((w) => ({
    id: `boss-${w.id}`,
    icon: w.icon,
    nameAr: `فاتح ${w.nameAr}`,
    nameEn: `Conqueror of ${w.nameEn}`,
    descAr: `هزمت تحدي ${w.nameAr}`,
    descEn: `Beat the ${w.nameEn} boss`,
    earned: (p: Progress) => !!p.levels[`${w.id}-boss`]?.completed,
  })),
];

export function earnedBadges(p: Progress): Badge[] {
  return BADGES.filter((b) => b.earned(p));
}

/** Badges that are newly earned compared with a previous progress snapshot. */
export function newBadges(before: Progress, after: Progress): Badge[] {
  const had = new Set(earnedBadges(before).map((b) => b.id));
  return earnedBadges(after).filter((b) => !had.has(b.id));
}
