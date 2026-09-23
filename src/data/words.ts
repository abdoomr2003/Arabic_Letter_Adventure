import {
  analyzeWord, normalizeLetter, slotOf, type Slot,
} from '../game/arabic';

export interface Word {
  /** Fully vowelled Arabic spelling — the thing the learner reads. */
  ar: string;
  /** Latin transliteration, support material only. */
  translit: string;
  /** English meaning, support material only. */
  en: string;
  /** 1 = short & very common, 2 = everyday, 3 = longer / less common. */
  difficulty: 1 | 2 | 3;
  /** Optional emoji used as a friendly picture cue. */
  emoji?: string;
}

/**
 * One shared word bank.  Which letter sits where is *derived* from the word by the
 * shaping rules in game/arabic.ts — never hand-annotated — so an entry can never
 * disagree with what the learner actually sees on screen.
 */
export const WORDS: Word[] = [
  // ——— alif ———
  { ar: 'أَسَد', translit: 'asad', en: 'lion', difficulty: 1, emoji: '🦁' },
  { ar: 'أَرْنَب', translit: 'arnab', en: 'rabbit', difficulty: 2, emoji: '🐰' },
  { ar: 'بَاب', translit: 'baab', en: 'door', difficulty: 1, emoji: '🚪' },
  { ar: 'سَمَاء', translit: 'samaa', en: 'sky', difficulty: 2, emoji: '🌌' },
  { ar: 'مَاء', translit: 'maa', en: 'water', difficulty: 1, emoji: '💧' },
  { ar: 'نَار', translit: 'naar', en: 'fire', difficulty: 1, emoji: '🔥' },
  { ar: 'كِتَاب', translit: 'kitaab', en: 'book', difficulty: 1, emoji: '📖' },
  { ar: 'حِصَان', translit: 'hisaan', en: 'horse', difficulty: 2, emoji: '🐴' },
  { ar: 'غَزَال', translit: 'ghazaal', en: 'gazelle', difficulty: 2, emoji: '🦌' },
  { ar: 'جَبَل', translit: 'jabal', en: 'mountain', difficulty: 1, emoji: '⛰️' },
  { ar: 'اِسْم', translit: 'ism', en: 'name', difficulty: 2, emoji: '🏷️' },
  { ar: 'اِبْن', translit: 'ibn', en: 'son', difficulty: 2, emoji: '👦' },
  { ar: 'عَصَا', translit: 'asaa', en: 'stick', difficulty: 2, emoji: '🦯' },
  { ar: 'دُنْيَا', translit: 'dunyaa', en: 'world', difficulty: 3, emoji: '🌍' },
  { ar: 'سَمَا', translit: 'samaa', en: 'sky', difficulty: 2, emoji: '☁️' },

  // ——— baa ———
  { ar: 'بَيْت', translit: 'bayt', en: 'house', difficulty: 1, emoji: '🏠' },
  { ar: 'بَحْر', translit: 'bahr', en: 'sea', difficulty: 1, emoji: '🌊' },
  { ar: 'بَقَرَة', translit: 'baqara', en: 'cow', difficulty: 2, emoji: '🐄' },
  { ar: 'بَطَّة', translit: 'batta', en: 'duck', difficulty: 2, emoji: '🦆' },
  { ar: 'حَبْل', translit: 'habl', en: 'rope', difficulty: 2, emoji: '🪢' },
  { ar: 'لَبَن', translit: 'laban', en: 'milk', difficulty: 1, emoji: '🥛' },
  { ar: 'قَلْب', translit: 'qalb', en: 'heart', difficulty: 1, emoji: '❤️' },
  { ar: 'حَلِيب', translit: 'haleeb', en: 'milk', difficulty: 2, emoji: '🥛' },
  { ar: 'عِنَب', translit: 'inab', en: 'grapes', difficulty: 1, emoji: '🍇' },
  { ar: 'ذَهَب', translit: 'dhahab', en: 'gold', difficulty: 2, emoji: '🪙' },
  { ar: 'حَقِيبَة', translit: 'haqeeba', en: 'bag', difficulty: 3, emoji: '🎒' },
  { ar: 'مَكْتَب', translit: 'maktab', en: 'desk', difficulty: 2, emoji: '🗄️' },

  // ——— taa ———
  { ar: 'تَاج', translit: 'taaj', en: 'crown', difficulty: 1, emoji: '👑' },
  { ar: 'تُفَّاح', translit: 'tuffaah', en: 'apples', difficulty: 2, emoji: '🍎' },
  { ar: 'تَمْر', translit: 'tamr', en: 'dates', difficulty: 1, emoji: '🌴' },
  { ar: 'تُوت', translit: 'toot', en: 'berries', difficulty: 1, emoji: '🫐' },
  { ar: 'بِنْت', translit: 'bint', en: 'girl', difficulty: 1, emoji: '👧' },
  { ar: 'كُتُب', translit: 'kutub', en: 'books', difficulty: 2, emoji: '📚' },
  { ar: 'بَيْتِي', translit: 'bayti', en: 'my house', difficulty: 2 },

  // ——— thaa ———
  { ar: 'ثَلْج', translit: 'thalj', en: 'snow', difficulty: 1, emoji: '❄️' },
  { ar: 'ثَعْلَب', translit: 'thaalab', en: 'fox', difficulty: 2, emoji: '🦊' },
  { ar: 'ثَوْب', translit: 'thawb', en: 'garment', difficulty: 2, emoji: '👗' },
  { ar: 'مُثَلَّث', translit: 'muthallath', en: 'triangle', difficulty: 3, emoji: '🔺' },
  { ar: 'حَدِيث', translit: 'hadeeth', en: 'talk', difficulty: 3 },
  { ar: 'بَحْث', translit: 'bahth', en: 'search', difficulty: 3, emoji: '🔎' },

  // ——— jeem ———
  { ar: 'جَمَل', translit: 'jamal', en: 'camel', difficulty: 1, emoji: '🐫' },
  { ar: 'جَزَر', translit: 'jazar', en: 'carrots', difficulty: 2, emoji: '🥕' },
  { ar: 'شَجَرَة', translit: 'shajara', en: 'tree', difficulty: 2, emoji: '🌳' },
  { ar: 'دَجَاج', translit: 'dajaaj', en: 'chicken', difficulty: 2, emoji: '🐔' },
  { ar: 'سِجَاد', translit: 'sijaad', en: 'carpet', difficulty: 3, emoji: '🧶' },

  // ——— haa (ح) ———
  { ar: 'حُوت', translit: 'hoot', en: 'whale', difficulty: 1, emoji: '🐋' },
  { ar: 'حَجَر', translit: 'hajar', en: 'stone', difficulty: 1, emoji: '🪨' },
  { ar: 'مِفْتَاح', translit: 'miftaah', en: 'key', difficulty: 3, emoji: '🔑' },
  { ar: 'سَبَح', translit: 'sabaha', en: 'he swam', difficulty: 2, emoji: '🏊' },
  { ar: 'لَحْم', translit: 'lahm', en: 'meat', difficulty: 2, emoji: '🍖' },

  // ——— khaa ———
  { ar: 'خُبْز', translit: 'khubz', en: 'bread', difficulty: 1, emoji: '🍞' },
  { ar: 'خَرُوف', translit: 'kharoof', en: 'sheep', difficulty: 2, emoji: '🐑' },
  { ar: 'نَخْلَة', translit: 'nakhla', en: 'palm tree', difficulty: 2, emoji: '🌴' },
  { ar: 'بِطِّيخ', translit: 'bitteekh', en: 'watermelon', difficulty: 3, emoji: '🍉' },
  { ar: 'مَطْبَخ', translit: 'matbakh', en: 'kitchen', difficulty: 3, emoji: '🍳' },

  // ——— dal ———
  { ar: 'دُبّ', translit: 'dubb', en: 'bear', difficulty: 1, emoji: '🐻' },
  { ar: 'دَرْس', translit: 'dars', en: 'lesson', difficulty: 2, emoji: '📝' },
  { ar: 'مَدْرَسَة', translit: 'madrasa', en: 'school', difficulty: 3, emoji: '🏫' },
  { ar: 'يَد', translit: 'yad', en: 'hand', difficulty: 1, emoji: '✋' },
  { ar: 'وَرْد', translit: 'ward', en: 'roses', difficulty: 1, emoji: '🌹' },
  { ar: 'بَلَد', translit: 'balad', en: 'country', difficulty: 2, emoji: '🗺️' },

  // ——— thal ———
  { ar: 'ذِئْب', translit: 'dhib', en: 'wolf', difficulty: 2, emoji: '🐺' },
  { ar: 'ذُرَة', translit: 'dhura', en: 'corn', difficulty: 2, emoji: '🌽' },
  { ar: 'لَذِيذ', translit: 'ladheedh', en: 'delicious', difficulty: 3, emoji: '😋' },
  { ar: 'أُسْتَاذ', translit: 'ustaadh', en: 'teacher', difficulty: 3, emoji: '👨‍🏫' },
  { ar: 'نَافِذَة', translit: 'naafidha', en: 'window', difficulty: 3, emoji: '🪟' },

  // ——— raa ———
  { ar: 'رَمْل', translit: 'raml', en: 'sand', difficulty: 1, emoji: '🏜️' },
  { ar: 'رَأْس', translit: 'ras', en: 'head', difficulty: 2, emoji: '🗣️' },
  { ar: 'قَمَر', translit: 'qamar', en: 'moon', difficulty: 1, emoji: '🌙' },
  { ar: 'سَرِير', translit: 'sareer', en: 'bed', difficulty: 3, emoji: '🛏️' },
  { ar: 'فَأْر', translit: 'far', en: 'mouse', difficulty: 2, emoji: '🐭' },

  // ——— zay ———
  { ar: 'زَهْرَة', translit: 'zahra', en: 'flower', difficulty: 2, emoji: '🌸' },
  { ar: 'زَيْت', translit: 'zayt', en: 'oil', difficulty: 1, emoji: '🫒' },
  { ar: 'مَوْز', translit: 'mawz', en: 'banana', difficulty: 1, emoji: '🍌' },
  { ar: 'أَرُزّ', translit: 'aruzz', en: 'rice', difficulty: 2, emoji: '🍚' },
  { ar: 'عَزِيز', translit: 'azeez', en: 'dear', difficulty: 3 },

  // ——— seen ———
  { ar: 'سَمَك', translit: 'samak', en: 'fish', difficulty: 1, emoji: '🐟' },
  { ar: 'سَيَّارَة', translit: 'sayyaara', en: 'car', difficulty: 3, emoji: '🚗' },
  { ar: 'شَمْس', translit: 'shams', en: 'sun', difficulty: 1, emoji: '☀️' },
  { ar: 'عَسَل', translit: 'asal', en: 'honey', difficulty: 1, emoji: '🍯' },
  { ar: 'كُرْسِيّ', translit: 'kursiyy', en: 'chair', difficulty: 2, emoji: '🪑' },
  { ar: 'قَوْس', translit: 'qaws', en: 'bow', difficulty: 2, emoji: '🏹' },

  // ——— sheen ———
  { ar: 'شَجَر', translit: 'shajar', en: 'trees', difficulty: 1, emoji: '🌲' },
  { ar: 'مِشْمِش', translit: 'mishmish', en: 'apricot', difficulty: 3, emoji: '🍑' },
  { ar: 'عُشّ', translit: 'ushsh', en: 'nest', difficulty: 2, emoji: '🪺' },
  { ar: 'فِرَاش', translit: 'firaash', en: 'bedding', difficulty: 3, emoji: '🛌' },
  { ar: 'نَشِيط', translit: 'nasheet', en: 'active', difficulty: 3, emoji: '⚡' },
  { ar: 'شَيْء', translit: 'shay', en: 'thing', difficulty: 2, emoji: '📦' },

  // ——— sad ———
  { ar: 'صَقْر', translit: 'saqr', en: 'falcon', difficulty: 2, emoji: '🦅' },
  { ar: 'صَدِيق', translit: 'sadeeq', en: 'friend', difficulty: 3, emoji: '🤝' },
  { ar: 'عُصْفُور', translit: 'usfoor', en: 'small bird', difficulty: 3, emoji: '🐦' },
  { ar: 'قَفَص', translit: 'qafas', en: 'cage', difficulty: 2, emoji: '🪤' },
  { ar: 'قِصَّة', translit: 'qissa', en: 'story', difficulty: 2, emoji: '📚' },

  // ——— dad ———
  { ar: 'ضِفْدَع', translit: 'difda', en: 'frog', difficulty: 3, emoji: '🐸' },
  { ar: 'ضَوْء', translit: 'daw', en: 'light', difficulty: 2, emoji: '💡' },
  { ar: 'بَيْض', translit: 'bayd', en: 'eggs', difficulty: 1, emoji: '🥚' },
  { ar: 'أَبْيَض', translit: 'abyad', en: 'white', difficulty: 2, emoji: '⚪' },
  { ar: 'خُضَار', translit: 'khudaar', en: 'vegetables', difficulty: 3, emoji: '🥦' },

  // ——— taa (ط) ———
  { ar: 'طَبْل', translit: 'tabl', en: 'drum', difficulty: 1, emoji: '🥁' },
  { ar: 'طَبَق', translit: 'tabaq', en: 'plate', difficulty: 2, emoji: '🍽️' },
  { ar: 'مَطَر', translit: 'matar', en: 'rain', difficulty: 1, emoji: '🌧️' },
  { ar: 'قِطّ', translit: 'qitt', en: 'cat', difficulty: 1, emoji: '🐈' },
  { ar: 'خَطّ', translit: 'khatt', en: 'line', difficulty: 2, emoji: '➖' },

  // ——— zaa (ظ) ———
  { ar: 'ظَرْف', translit: 'zarf', en: 'envelope', difficulty: 2, emoji: '✉️' },
  { ar: 'ظِلّ', translit: 'zill', en: 'shadow', difficulty: 2, emoji: '🌑' },
  { ar: 'نَظَّارَة', translit: 'nazzaara', en: 'glasses', difficulty: 3, emoji: '👓' },
  { ar: 'حَفِظ', translit: 'hafiza', en: 'he memorised', difficulty: 3, emoji: '🧠' },
  { ar: 'نَظِيف', translit: 'nazeef', en: 'clean', difficulty: 3, emoji: '🧼' },

  // ——— ayn ———
  { ar: 'عَيْن', translit: 'ayn', en: 'eye', difficulty: 1, emoji: '👁️' },
  { ar: 'شَعْر', translit: 'shar', en: 'hair', difficulty: 2, emoji: '💇' },
  { ar: 'سَبْع', translit: 'sab', en: 'seven', difficulty: 2, emoji: '7️⃣' },
  { ar: 'مَعَ', translit: 'maa', en: 'with', difficulty: 1 },

  // ——— ghayn ———
  { ar: 'غُرَاب', translit: 'ghuraab', en: 'crow', difficulty: 2, emoji: '🐦‍⬛' },
  { ar: 'صَغِير', translit: 'sagheer', en: 'small', difficulty: 3, emoji: '🐜' },
  { ar: 'فَرَاغ', translit: 'faraagh', en: 'empty space', difficulty: 3 },
  { ar: 'لُغَة', translit: 'lugha', en: 'language', difficulty: 3, emoji: '🗣️' },
  { ar: 'صَمْغ', translit: 'samgh', en: 'glue', difficulty: 3 },

  // ——— faa ———
  { ar: 'فِيل', translit: 'feel', en: 'elephant', difficulty: 1, emoji: '🐘' },
  { ar: 'فَرَاشَة', translit: 'faraasha', en: 'butterfly', difficulty: 3, emoji: '🦋' },
  { ar: 'سَفِينَة', translit: 'safeena', en: 'ship', difficulty: 3, emoji: '🚢' },
  { ar: 'كَفّ', translit: 'kaff', en: 'palm of hand', difficulty: 2, emoji: '🤚' },
  { ar: 'رَفّ', translit: 'raff', en: 'shelf', difficulty: 2, emoji: '🗄️' },

  // ——— qaf ———
  { ar: 'قَلَم', translit: 'qalam', en: 'pen', difficulty: 1, emoji: '✏️' },
  { ar: 'بُرْتُقَال', translit: 'burtuqaal', en: 'orange', difficulty: 3, emoji: '🍊' },
  { ar: 'وَرَق', translit: 'waraq', en: 'paper', difficulty: 2, emoji: '📄' },
  { ar: 'سُوق', translit: 'sooq', en: 'market', difficulty: 2, emoji: '🏪' },

  // ——— kaf ———
  { ar: 'كَلْب', translit: 'kalb', en: 'dog', difficulty: 1, emoji: '🐕' },
  { ar: 'سُكَّر', translit: 'sukkar', en: 'sugar', difficulty: 2, emoji: '🍬' },
  { ar: 'مَلِك', translit: 'malik', en: 'king', difficulty: 1, emoji: '🤴' },
  { ar: 'سَمَكَة', translit: 'samaka', en: 'a fish', difficulty: 2, emoji: '🐠' },

  // ——— lam ———
  { ar: 'لَيْل', translit: 'layl', en: 'night', difficulty: 1, emoji: '🌃' },
  { ar: 'لَوْز', translit: 'lawz', en: 'almonds', difficulty: 2, emoji: '🌰' },
  { ar: 'حَلَق', translit: 'halaq', en: 'earring', difficulty: 3, emoji: '💍' },
  { ar: 'عَقْل', translit: 'aql', en: 'mind', difficulty: 2, emoji: '🧠' },

  // ——— meem ———
  { ar: 'مَوْز', translit: 'mawz', en: 'banana', difficulty: 1, emoji: '🍌' },
  { ar: 'مِلْح', translit: 'milh', en: 'salt', difficulty: 2, emoji: '🧂' },
  { ar: 'نَجْم', translit: 'najm', en: 'star', difficulty: 1, emoji: '⭐' },
  { ar: 'حَمَام', translit: 'hamaam', en: 'pigeons', difficulty: 2, emoji: '🕊️' },
  { ar: 'قَدَم', translit: 'qadam', en: 'foot', difficulty: 2, emoji: '🦶' },

  // ——— noon ———
  { ar: 'نَهْر', translit: 'nahr', en: 'river', difficulty: 1, emoji: '🏞️' },
  { ar: 'نَمْل', translit: 'naml', en: 'ants', difficulty: 2, emoji: '🐜' },
  { ar: 'سِنْجَاب', translit: 'sinjaab', en: 'squirrel', difficulty: 3, emoji: '🐿️' },
  { ar: 'غُصْن', translit: 'ghusn', en: 'branch', difficulty: 3, emoji: '🌿' },
  { ar: 'حِضْن', translit: 'hidn', en: 'embrace', difficulty: 3, emoji: '🤗' },

  // ——— haa (ه) ———
  { ar: 'هِلَال', translit: 'hilaal', en: 'crescent', difficulty: 2, emoji: '🌙' },
  { ar: 'هُدْهُد', translit: 'hudhud', en: 'hoopoe bird', difficulty: 3, emoji: '🐦' },
  { ar: 'نَهَار', translit: 'nahaar', en: 'daytime', difficulty: 2, emoji: '🌞' },
  { ar: 'وَجْه', translit: 'wajh', en: 'face', difficulty: 2, emoji: '😀' },
  { ar: 'فَاكِهَة', translit: 'faakiha', en: 'fruit', difficulty: 3, emoji: '🍉' },

  // ——— waw ———
  { ar: 'وَلَد', translit: 'walad', en: 'boy', difficulty: 1, emoji: '👦' },
  { ar: 'وَزِير', translit: 'wazeer', en: 'minister', difficulty: 3, emoji: '🎩' },
  { ar: 'جَوْز', translit: 'jawz', en: 'walnuts', difficulty: 2, emoji: '🥜' },
  { ar: 'دَلْو', translit: 'dalw', en: 'bucket', difficulty: 2, emoji: '🪣' },
  { ar: 'حُلْو', translit: 'hulw', en: 'sweet', difficulty: 2, emoji: '🍭' },

  // ——— yaa ———
  { ar: 'يَوْم', translit: 'yawm', en: 'day', difficulty: 1, emoji: '📅' },
  { ar: 'يَمَام', translit: 'yamaam', en: 'doves', difficulty: 3, emoji: '🕊️' },
  { ar: 'بَيْضَة', translit: 'bayda', en: 'an egg', difficulty: 2, emoji: '🥚' },
  { ar: 'كَبِير', translit: 'kabeer', en: 'big', difficulty: 2, emoji: '🐘' },
];

/** A word plus the *computed* facts about where a target letter sits inside it. */
export interface WordHit {
  word: Word;
  /** Index into the letter sequence (diacritics excluded). */
  index: number;
  slot: Slot;
  /** Contextual form the letter is actually rendered in inside this word. */
  position: ReturnType<typeof analyzeWord>[number]['position'];
  /** Total letters in the word. */
  total: number;
  /** The character as actually written in the word — may be a variant such as أ or ة. */
  written: string;
}

const HIT_INDEX = new Map<string, WordHit[]>();

function indexAll() {
  for (const word of WORDS) {
    const letters = analyzeWord(word.ar);
    letters.forEach((l, i) => {
      const key = normalizeLetter(l.base);
      const hit: WordHit = {
        word,
        index: i,
        slot: slotOf(i, letters.length),
        position: l.position,
        total: letters.length,
        written: l.base,
      };
      const bucket = HIT_INDEX.get(key);
      if (bucket) bucket.push(hit);
      else HIT_INDEX.set(key, [hit]);
    });
  }
}
indexAll();

/** Every word containing `letter`, with where it sits. */
export function wordsWithLetter(letter: string): WordHit[] {
  return HIT_INDEX.get(normalizeLetter(letter)) ?? [];
}

/** Words where `letter` sits in the requested slot of the word. */
export function wordsWithLetterAt(letter: string, slot: Slot, maxDifficulty = 3): WordHit[] {
  return wordsWithLetter(letter).filter(
    (h) => h.slot === slot && h.word.difficulty <= maxDifficulty,
  );
}

/** Words where `letter` is rendered in a given contextual form. */
export function wordsWithForm(
  letter: string,
  position: 'isolated' | 'initial' | 'medial' | 'final',
  maxDifficulty = 3,
): WordHit[] {
  return wordsWithLetter(letter).filter(
    (h) => h.position === position && h.word.difficulty <= maxDifficulty,
  );
}
