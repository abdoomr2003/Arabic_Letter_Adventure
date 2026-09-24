import { joiningType, type JoiningType } from '../game/arabic';

export type DotPlace = 'none' | 'above' | 'below';

export interface LetterDots {
  count: 0 | 1 | 2 | 3;
  place: DotPlace;
}

export interface Letter {
  /** Stable machine id. */
  id: string;
  /** The letter itself — always the plain Unicode base character. */
  char: string;
  /** Arabic name of the letter, e.g. باء */
  nameAr: string;
  /** English name of the letter, e.g. Baa */
  nameEn: string;
  /** Rough Latin transliteration of the letter's sound. */
  translit: string;
  /** Phonetic hint shown to non-Arabic speakers. */
  sound: string;
  /** How the letter is pronounced, in one short English line. */
  soundHintEn: string;
  /** Same, in Arabic. */
  soundHintAr: string;
  dots: LetterDots;
  /** Letters that share a skeleton or are easily confused with this one. */
  confusableWith: string[];
  /** World this letter lives in (see worlds.ts). */
  worldId: string;
  /** Position in the standard alphabet order. */
  order: number;
  /** Does the letter reach below the writing line? Used as a duel clue. */
  descends: boolean;
  /** Is it one of the "tall" letters? Used as a duel clue. */
  tall: boolean;
  /** Derived, never hand-written. */
  joining: JoiningType;
  /** Audio file ids — the architecture is ready even before the files exist. */
  audio: { name: string; sound: string };
}

interface RawLetter extends Omit<Letter, 'joining' | 'audio'> {}

const RAW: RawLetter[] = [
  {
    id: 'alif', char: 'ا', nameAr: 'أَلِف', nameEn: 'Alif', translit: 'a', sound: '/aː/',
    soundHintEn: 'A long "aa", like the a in "father".', soundHintAr: 'صوت ألف ممدودة: آ',
    dots: { count: 0, place: 'none' }, confusableWith: ['ل'], worldId: 'alif', order: 1,
    descends: false, tall: true,
  },
  {
    id: 'baa', char: 'ب', nameAr: 'بَاء', nameEn: 'Baa', translit: 'b', sound: '/b/',
    soundHintEn: 'Like the b in "ball".', soundHintAr: 'صوت الباء كما في «باب»',
    dots: { count: 1, place: 'below' }, confusableWith: ['ت', 'ث', 'ن', 'ي'], worldId: 'plates', order: 2,
    descends: false, tall: false,
  },
  {
    id: 'taa', char: 'ت', nameAr: 'تَاء', nameEn: 'Taa', translit: 't', sound: '/t/',
    soundHintEn: 'Like the t in "table".', soundHintAr: 'صوت التاء كما في «تاج»',
    dots: { count: 2, place: 'above' }, confusableWith: ['ب', 'ث', 'ن', 'ي'], worldId: 'plates', order: 3,
    descends: false, tall: false,
  },
  {
    id: 'thaa', char: 'ث', nameAr: 'ثَاء', nameEn: 'Thaa', translit: 'th', sound: '/θ/',
    soundHintEn: 'Like the th in "think".', soundHintAr: 'صوت الثاء كما في «ثلج»',
    dots: { count: 3, place: 'above' }, confusableWith: ['ب', 'ت', 'ن'], worldId: 'plates', order: 4,
    descends: false, tall: false,
  },
  {
    id: 'jeem', char: 'ج', nameAr: 'جِيم', nameEn: 'Jeem', translit: 'j', sound: '/dʒ/',
    soundHintEn: 'Like the j in "jam".', soundHintAr: 'صوت الجيم كما في «جمل»',
    dots: { count: 1, place: 'below' }, confusableWith: ['ح', 'خ'], worldId: 'bellies', order: 5,
    descends: true, tall: false,
  },
  {
    id: 'haa-h', char: 'ح', nameAr: 'حَاء', nameEn: 'Haa', translit: 'ḥ', sound: '/ħ/',
    soundHintEn: 'A breathy h, made deep in the throat.', soundHintAr: 'حاء حلقية كما في «حوت»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ج', 'خ'], worldId: 'bellies', order: 6,
    descends: true, tall: false,
  },
  {
    id: 'khaa', char: 'خ', nameAr: 'خَاء', nameEn: 'Khaa', translit: 'kh', sound: '/x/',
    soundHintEn: 'Like the ch in Scottish "loch".', soundHintAr: 'صوت الخاء كما في «خبز»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ج', 'ح'], worldId: 'bellies', order: 7,
    descends: true, tall: false,
  },
  {
    id: 'dal', char: 'د', nameAr: 'دَال', nameEn: 'Dal', translit: 'd', sound: '/d/',
    soundHintEn: 'Like the d in "door".', soundHintAr: 'صوت الدال كما في «دب»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ذ', 'ر'], worldId: 'chairs', order: 8,
    descends: false, tall: false,
  },
  {
    id: 'thal', char: 'ذ', nameAr: 'ذَال', nameEn: 'Dhal', translit: 'dh', sound: '/ð/',
    soundHintEn: 'Like the th in "this".', soundHintAr: 'صوت الذال كما في «ذهب»',
    dots: { count: 1, place: 'above' }, confusableWith: ['د', 'ز'], worldId: 'chairs', order: 9,
    descends: false, tall: false,
  },
  {
    id: 'raa', char: 'ر', nameAr: 'رَاء', nameEn: 'Raa', translit: 'r', sound: '/r/',
    soundHintEn: 'A rolled r, like Spanish "pero".', soundHintAr: 'صوت الراء كما في «رمل»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ز', 'د'], worldId: 'snakes', order: 10,
    descends: true, tall: false,
  },
  {
    id: 'zay', char: 'ز', nameAr: 'زَاي', nameEn: 'Zay', translit: 'z', sound: '/z/',
    soundHintEn: 'Like the z in "zoo".', soundHintAr: 'صوت الزاي كما في «زهرة»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ر', 'ذ'], worldId: 'snakes', order: 11,
    descends: true, tall: false,
  },
  {
    id: 'seen', char: 'س', nameAr: 'سِين', nameEn: 'Seen', translit: 's', sound: '/s/',
    soundHintEn: 'Like the s in "sun".', soundHintAr: 'صوت السين كما في «سمك»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ش', 'ص'], worldId: 'swimmers', order: 12,
    descends: true, tall: false,
  },
  {
    id: 'sheen', char: 'ش', nameAr: 'شِين', nameEn: 'Sheen', translit: 'sh', sound: '/ʃ/',
    soundHintEn: 'Like the sh in "ship".', soundHintAr: 'صوت الشين كما في «شمس»',
    dots: { count: 3, place: 'above' }, confusableWith: ['س', 'ض'], worldId: 'swimmers', order: 13,
    descends: true, tall: false,
  },
  {
    id: 'sad', char: 'ص', nameAr: 'صَاد', nameEn: 'Sad', translit: 'ṣ', sound: '/sˤ/',
    soundHintEn: 'A heavy, deep s.', soundHintAr: 'صاد مفخَّمة كما في «صقر»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ض', 'س'], worldId: 'swimmers', order: 14,
    descends: true, tall: false,
  },
  {
    id: 'dad', char: 'ض', nameAr: 'ضَاد', nameEn: 'Dad', translit: 'ḍ', sound: '/dˤ/',
    soundHintEn: 'A heavy, deep d — the letter Arabic is named after.', soundHintAr: 'ضاد مفخَّمة كما في «ضفدع»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ص', 'ش'], worldId: 'swimmers', order: 15,
    descends: true, tall: false,
  },
  {
    id: 'taa-t', char: 'ط', nameAr: 'طَاء', nameEn: 'Taa (heavy)', translit: 'ṭ', sound: '/tˤ/',
    soundHintEn: 'A heavy, deep t.', soundHintAr: 'طاء مفخَّمة كما في «طبل»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ظ'], worldId: 'minaret', order: 16,
    descends: false, tall: true,
  },
  {
    id: 'zaa', char: 'ظ', nameAr: 'ظَاء', nameEn: 'Zaa (heavy)', translit: 'ẓ', sound: '/ðˤ/',
    soundHintEn: 'A heavy, deep "th" as in "that".', soundHintAr: 'ظاء مفخَّمة كما في «ظرف»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ط'], worldId: 'minaret', order: 17,
    descends: false, tall: true,
  },
  {
    id: 'ayn', char: 'ع', nameAr: 'عَيْن', nameEn: 'Ayn', translit: 'ʿ', sound: '/ʕ/',
    soundHintEn: 'A deep throat sound — squeeze the throat and voice it.', soundHintAr: 'عين حلقية كما في «عين»',
    dots: { count: 0, place: 'none' }, confusableWith: ['غ', 'ح'], worldId: 'bellies', order: 18,
    descends: true, tall: false,
  },
  {
    id: 'ghayn', char: 'غ', nameAr: 'غَيْن', nameEn: 'Ghayn', translit: 'gh', sound: '/ɣ/',
    soundHintEn: 'Like a gargled French r.', soundHintAr: 'صوت الغين كما في «غزال»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ع'], worldId: 'bellies', order: 19,
    descends: true, tall: false,
  },
  {
    id: 'faa', char: 'ف', nameAr: 'فَاء', nameEn: 'Faa', translit: 'f', sound: '/f/',
    soundHintEn: 'Like the f in "fish".', soundHintAr: 'صوت الفاء كما في «فيل»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ق'], worldId: 'plates', order: 20,
    descends: false, tall: false,
  },
  {
    id: 'qaf', char: 'ق', nameAr: 'قَاف', nameEn: 'Qaf', translit: 'q', sound: '/q/',
    soundHintEn: 'A k made far back in the throat.', soundHintAr: 'صوت القاف كما في «قمر»',
    dots: { count: 2, place: 'above' }, confusableWith: ['ف'], worldId: 'swimmers', order: 21,
    descends: true, tall: false,
  },
  {
    id: 'kaf', char: 'ك', nameAr: 'كَاف', nameEn: 'Kaf', translit: 'k', sound: '/k/',
    soundHintEn: 'Like the k in "kite".', soundHintAr: 'صوت الكاف كما في «كتاب»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ل'], worldId: 'minaret', order: 22,
    descends: false, tall: true,
  },
  {
    id: 'lam', char: 'ل', nameAr: 'لَام', nameEn: 'Lam', translit: 'l', sound: '/l/',
    soundHintEn: 'Like the l in "lamp".', soundHintAr: 'صوت اللام كما في «لبن»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ك', 'ا'], worldId: 'minaret', order: 23,
    descends: true, tall: true,
  },
  {
    id: 'meem', char: 'م', nameAr: 'مِيم', nameEn: 'Meem', translit: 'm', sound: '/m/',
    soundHintEn: 'Like the m in "moon".', soundHintAr: 'صوت الميم كما في «موز»',
    dots: { count: 0, place: 'none' }, confusableWith: [], worldId: 'snakes', order: 24,
    descends: true, tall: false,
  },
  {
    id: 'noon', char: 'ن', nameAr: 'نُون', nameEn: 'Noon', translit: 'n', sound: '/n/',
    soundHintEn: 'Like the n in "nest".', soundHintAr: 'صوت النون كما في «نجم»',
    dots: { count: 1, place: 'above' }, confusableWith: ['ب', 'ت', 'ث', 'ي'], worldId: 'swimmers', order: 25,
    descends: true, tall: false,
  },
  {
    id: 'haa-soft', char: 'ه', nameAr: 'هَاء', nameEn: 'Haa (soft)', translit: 'h', sound: '/h/',
    soundHintEn: 'A light h, like the h in "hello".', soundHintAr: 'صوت الهاء كما في «هلال»',
    dots: { count: 0, place: 'none' }, confusableWith: [], worldId: 'bellies', order: 26,
    descends: false, tall: false,
  },
  {
    id: 'waw', char: 'و', nameAr: 'وَاو', nameEn: 'Waw', translit: 'w', sound: '/w/',
    soundHintEn: 'Like the w in "water", or a long "oo".', soundHintAr: 'صوت الواو كما في «ورد»',
    dots: { count: 0, place: 'none' }, confusableWith: ['ر'], worldId: 'snakes', order: 27,
    descends: true, tall: false,
  },
  {
    id: 'yaa', char: 'ي', nameAr: 'يَاء', nameEn: 'Yaa', translit: 'y', sound: '/j/',
    soundHintEn: 'Like the y in "yes", or a long "ee".', soundHintAr: 'صوت الياء كما في «يد»',
    dots: { count: 2, place: 'below' }, confusableWith: ['ب', 'ت', 'ث', 'ن'], worldId: 'swimmers', order: 28,
    descends: true, tall: false,
  },
];

export const LETTERS: Letter[] = RAW.map((l) => ({
  ...l,
  joining: joiningType(l.char),
  audio: { name: `letters/${l.id}-name.mp3`, sound: `letters/${l.id}-sound.mp3` },
}));

const BY_CHAR = new Map(LETTERS.map((l) => [l.char, l]));

export function letterByChar(char: string): Letter | undefined {
  return BY_CHAR.get(char);
}

export const ALL_CHARS = LETTERS.map((l) => l.char);
