/**
 * The seven worlds of the adventure, exactly as the design establishes them:
 * each world is a *shape family* — the letters that live there share a skeleton,
 * which is why the world looks the way it does (plates, bellies, chairs, snakes…).
 */
export interface World {
  id: string;
  order: number;
  nameAr: string;
  nameEn: string;
  /** One line of flavour shown on the world card. */
  taglineAr: string;
  taglineEn: string;
  /** Why these letters belong together — the mnemonic the world is built on. */
  hintAr: string;
  hintEn: string;
  /** Letters taught here, in teaching order. */
  letters: string[];
  icon: string;
  art: string;
  /** Optional character who rules this world, drawn on the world screen. */
  guardian?: string;
  /** Accent colours used for this world's UI tint. */
  accent: string;
  accent2: string;
  /** Position of the world's node on the adventure map, in % of the map box. */
  map: { x: number; y: number };
}

export const WORLDS: World[] = [
  {
    id: 'alif',
    order: 1,
    nameAr: 'مملكة الملك الألف',
    nameEn: 'Kingdom of King Alif',
    taglineAr: 'حيث يبدأ كل شيء',
    taglineEn: 'Where everything begins',
    hintAr: 'الألف حرف واقف طويل، لا يتصل بما بعده أبدًا.',
    hintEn: 'Alif stands tall and never joins to the letter after it.',
    letters: ['ا'],
    icon: '👑',
    art: 'world-alif',
    guardian: 'char-king-alif',
    accent: '#6f8cff',
    accent2: '#c9a227',
    map: { x: 9, y: 70 },
  },
  {
    id: 'plates',
    order: 2,
    nameAr: 'مدينة الأطباق',
    nameEn: 'City of Plates',
    taglineAr: 'أطباق تحمل النقاط',
    taglineEn: 'Plates that carry the dots',
    hintAr: 'كلها أطباق متشابهة — النقاط وحدها تخبرك أيّ حرف هو.',
    hintEn: 'They are all the same plate — only the dots tell you which letter it is.',
    letters: ['ب', 'ت', 'ث', 'ف'],
    icon: '🍽️',
    art: 'world-plates',
    accent: '#ff9a5b',
    accent2: '#ffd166',
    map: { x: 25, y: 40 },
  },
  {
    id: 'bellies',
    order: 3,
    nameAr: 'مجموعة البطون',
    nameEn: 'Village of Bellies',
    taglineAr: 'بطون مستديرة وذيول طويلة',
    taglineEn: 'Round bellies, long tails',
    hintAr: 'بطن مستديرة تنزل تحت السطر، والنقطة تحدد الحرف.',
    hintEn: 'A round belly that dips below the line — the dot decides the letter.',
    letters: ['ج', 'ح', 'خ', 'ع', 'غ', 'ه'],
    icon: '🛖',
    art: 'world-bellies',
    accent: '#7ec87e',
    accent2: '#ffd166',
    map: { x: 38, y: 70 },
  },
  {
    id: 'chairs',
    order: 4,
    nameAr: 'مدينة الكراسي',
    nameEn: 'City of Chairs',
    taglineAr: 'كراسٍ لا تتصل بما بعدها',
    taglineEn: 'Chairs that refuse to join forward',
    hintAr: 'الدال والذال كرسيّان: يتصلان بما قبلهما فقط.',
    hintEn: 'Dal and Dhal are chairs: they only join to the letter before them.',
    letters: ['د', 'ذ'],
    icon: '🪑',
    art: 'world-chairs',
    accent: '#b58cff',
    accent2: '#ff8fab',
    map: { x: 52, y: 36 },
  },
  {
    id: 'snakes',
    order: 5,
    nameAr: 'وادي الثعابين',
    nameEn: 'Valley of Snakes',
    taglineAr: 'ذيول تنساب تحت السطر',
    taglineEn: 'Tails that slide below the line',
    hintAr: 'ذيول منحنية تنزل تحت السطر مثل الثعبان.',
    hintEn: 'Curved tails that slide below the line like a snake.',
    letters: ['ر', 'ز', 'و', 'م'],
    icon: '🐍',
    art: 'world-snakes',
    accent: '#ffb84d',
    accent2: '#8bd3dd',
    map: { x: 66, y: 66 },
  },
  {
    id: 'swimmers',
    order: 6,
    nameAr: 'بحيرة السباحين',
    nameEn: "Swimmers' Lake",
    taglineAr: 'حروف تطفو فوق الماء',
    taglineEn: 'Letters floating on the water',
    hintAr: 'حروف لها حوض يطفو، وبعضها يتشابه كثيرًا.',
    hintEn: 'Letters with a floating basin — several look almost the same.',
    letters: ['س', 'ش', 'ص', 'ض', 'ن', 'ق', 'ي'],
    icon: '🏊',
    art: 'world-swimmers',
    accent: '#3fb6e8',
    accent2: '#7ef5d4',
    map: { x: 79, y: 34 },
  },
  {
    id: 'minaret',
    order: 7,
    nameAr: 'برج المئذنة',
    nameEn: 'Minaret Tower',
    taglineAr: 'أطول حروف المغامرة',
    taglineEn: 'The tallest letters of the adventure',
    hintAr: 'حروف طويلة كالمآذن، تُرى من بعيد.',
    hintEn: 'Tall letters like minarets — you can spot them from far away.',
    letters: ['ط', 'ظ', 'ك', 'ل'],
    icon: '🕌',
    art: 'world-minaret',
    accent: '#8ea2ff',
    accent2: '#ffd166',
    map: { x: 92, y: 66 },
  },
];

export const WORLD_BY_ID = new Map(WORLDS.map((w) => [w.id, w]));

export function worldOf(letter: string): World | undefined {
  return WORLDS.find((w) => w.letters.includes(letter));
}

/** Difficulty tier a world is played at — drives which challenges appear. */
export type Tier = 'beginner' | 'intermediate' | 'advanced';

export function tierOfWorld(order: number): Tier {
  if (order <= 2) return 'beginner';
  if (order <= 5) return 'intermediate';
  return 'advanced';
}
