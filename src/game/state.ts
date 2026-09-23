/**
 * One store for the whole game.  Screens read from it and dispatch into it;
 * nothing keeps its own copy of score, lives, coins or progress.
 */
import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch,
} from 'react';
import { buildLevel, type BuiltPhase } from './questions';
import { focusFor, recordAnswer, EMPTY_MASTERY } from './adaptive';
import { gradeLevel, comboMultiplier, questionScore, type LevelOutcome } from './scoring';
import * as store from './persistence';
import { LEVEL_BY_ID, LEVELS, isLevelUnlocked, isWorldUnlocked, nextLevelId } from '../data/levels';
import { WORLDS } from '../data/worlds';
import { newBadges, type Badge } from '../data/rewards';
import type { ChallengeType, LevelDef, SaveFile, Settings } from './types';

export const MAX_LIVES = 3;

export type Screen =
  | 'home' | 'map' | 'world' | 'play' | 'result' | 'fail' | 'profile' | 'howto';

export interface Session {
  levelId: string;
  seed: number;
  phases: BuiltPhase[];
  phaseIndex: number;
  questionIndex: number;
  lives: number;
  score: number;
  correct: number;
  asked: number;
  streak: number;
  bestCombo: number;
  coins: number;
  wordsDone: number;
  startedAt: number;
  status: 'playing' | 'won' | 'lost';
}

export interface Unlocks {
  levels: LevelDef[];
  worlds: typeof WORLDS;
  badges: Badge[];
}

export interface GameState {
  save: SaveFile;
  screen: Screen;
  worldId: string | null;
  levelId: string | null;
  session: Session | null;
  outcome: (LevelOutcome & { levelId: string; unlocks: Unlocks }) | null;
  settingsOpen: boolean;
}

export type Action =
  | { type: 'setScreen'; screen: Screen }
  | { type: 'openWorld'; worldId: string }
  | { type: 'startLevel'; levelId: string }
  | { type: 'answer'; correct: boolean; challenge: ChallengeType; letter: string; ms: number; value: number }
  | { type: 'nextQuestion' }
  | { type: 'phaseDone' }
  | { type: 'wordDone' }
  | { type: 'finishLevel' }
  | { type: 'loseLevel' }
  | { type: 'abandonLevel' }
  | { type: 'setSetting'; key: keyof Settings; value: Settings[keyof Settings] }
  | { type: 'setName'; name: string }
  | { type: 'setAvatar'; avatar: string }
  | { type: 'toggleSettings'; open?: boolean }
  | { type: 'resetProgress' };

export function initialState(): GameState {
  return {
    save: store.load(),
    screen: 'home',
    worldId: null,
    levelId: null,
    session: null,
    outcome: null,
    settingsOpen: false,
  };
}

const completedSet = (s: SaveFile) =>
  new Set(Object.entries(s.progress.levels).filter(([, r]) => r.completed).map(([id]) => id));

function makeSession(state: GameState, levelId: string): Session | null {
  const level = LEVEL_BY_ID.get(levelId);
  if (!level) return null;
  const seed = (Date.now() ^ (levelId.length * 2654435761)) >>> 0;
  const focus = focusFor(state.save.progress, level.targetLetters);
  return {
    levelId,
    seed,
    phases: buildLevel(level, seed, focus),
    phaseIndex: 0,
    questionIndex: 0,
    lives: MAX_LIVES,
    score: 0,
    correct: 0,
    asked: 0,
    streak: 0,
    bestCombo: 0,
    coins: 0,
    wordsDone: 0,
    startedAt: Date.now(),
    status: 'playing',
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'setScreen':
      return { ...state, screen: action.screen };

    case 'openWorld':
      return { ...state, screen: 'world', worldId: action.worldId };

    case 'startLevel': {
      const level = LEVEL_BY_ID.get(action.levelId);
      if (!level) return state;
      if (!isLevelUnlocked(action.levelId, completedSet(state.save))) return state;
      const session = makeSession(state, action.levelId);
      if (!session) return state;
      return {
        ...state,
        screen: 'play',
        worldId: level.worldId,
        levelId: action.levelId,
        session,
        outcome: null,
      };
    }

    case 'answer': {
      const s = state.session;
      if (!s || s.status !== 'playing') return state;
      const streak = action.correct ? s.streak + 1 : 0;
      const gained = action.correct ? questionScore(action.value, s.streak, action.ms) : 0;
      const lives = action.correct ? s.lives : s.lives - 1;
      const coins = s.coins + (action.correct ? Math.round(action.value / 10) * comboMultiplier(s.streak) : 0);

      const prevMastery = state.save.progress.mastery[action.letter] ?? EMPTY_MASTERY;
      const mastery = {
        ...state.save.progress.mastery,
        [action.letter]: recordAnswer(prevMastery, {
          correct: action.correct, type: action.challenge, ms: action.ms,
        }),
      };

      const session: Session = {
        ...s,
        lives: Math.max(0, lives),
        score: s.score + gained,
        correct: s.correct + (action.correct ? 1 : 0),
        asked: s.asked + 1,
        streak,
        bestCombo: Math.max(s.bestCombo, streak),
        coins,
        status: lives <= 0 ? 'lost' : s.status,
      };

      return {
        ...state,
        session,
        save: { ...state.save, progress: { ...state.save.progress, mastery } },
      };
    }

    case 'wordDone': {
      const s = state.session;
      if (!s) return state;
      return { ...state, session: { ...s, wordsDone: s.wordsDone + 1 } };
    }

    case 'nextQuestion': {
      const s = state.session;
      if (!s || s.status !== 'playing') return state;
      const phase = s.phases[s.phaseIndex];
      if (!phase) return state;
      if (s.questionIndex + 1 < phase.questions.length) {
        return { ...state, session: { ...s, questionIndex: s.questionIndex + 1 } };
      }
      return advancePhase(state, s);
    }

    case 'phaseDone': {
      const s = state.session;
      if (!s || s.status !== 'playing') return state;
      return advancePhase(state, s);
    }

    case 'finishLevel': {
      const s = state.session;
      const level = s && LEVEL_BY_ID.get(s.levelId);
      if (!s || !level) return state;

      const before = state.save.progress;
      const beforeCompleted = completedSet(state.save);

      const outcome = gradeLevel(level, {
        score: s.score, correct: s.correct, asked: s.asked,
        bestCombo: s.bestCombo, livesLeft: s.lives, maxLives: MAX_LIVES,
      });

      const prevRecord = before.levels[level.id];
      const record = {
        completed: true,
        stars: Math.max(prevRecord?.stars ?? 0, outcome.stars) as 0 | 1 | 2 | 3,
        bestScore: Math.max(prevRecord?.bestScore ?? 0, outcome.score),
        bestAccuracy: Math.max(prevRecord?.bestAccuracy ?? 0, outcome.accuracy),
        bestCombo: Math.max(prevRecord?.bestCombo ?? 0, outcome.bestCombo),
        plays: (prevRecord?.plays ?? 0) + 1,
      };

      const progress = {
        ...before,
        levels: { ...before.levels, [level.id]: record },
        coins: before.coins + outcome.coins + s.coins,
        xp: before.xp + outcome.xp,
        totalScore: before.totalScore + outcome.score,
        bestCombo: Math.max(before.bestCombo, s.bestCombo),
        wordsCompleted: before.wordsCompleted + s.wordsDone,
        lastPlayed: Date.now(),
      };

      const save: SaveFile = { ...state.save, progress };
      const afterCompleted = completedSet(save);

      const unlocks: Unlocks = {
        levels: LEVELS.filter(
          (l) => !isLevelUnlocked(l.id, beforeCompleted) && isLevelUnlocked(l.id, afterCompleted),
        ),
        worlds: WORLDS.filter(
          (w) => !isWorldUnlocked(w.id, beforeCompleted) && isWorldUnlocked(w.id, afterCompleted),
        ),
        badges: newBadges(before, progress),
      };
      progress.unlockedRewards = [
        ...new Set([...before.unlockedRewards, ...unlocks.badges.map((b) => b.id)]),
      ];

      return {
        ...state,
        save,
        session: { ...s, status: 'won' },
        outcome: { ...outcome, levelId: level.id, unlocks },
        screen: 'result',
      };
    }

    case 'loseLevel': {
      const s = state.session;
      if (!s || s.status !== 'playing') return state;
      return { ...state, session: { ...s, status: 'lost', lives: 0 } };
    }

    case 'abandonLevel':
      return { ...state, session: null, screen: state.worldId ? 'world' : 'map' };

    case 'setSetting':
      return {
        ...state,
        save: { ...state.save, settings: { ...state.save.settings, [action.key]: action.value } },
      };

    case 'setName':
      return { ...state, save: { ...state.save, profile: { ...state.save.profile, name: action.name } } };

    case 'setAvatar':
      return { ...state, save: { ...state.save, profile: { ...state.save.profile, avatar: action.avatar } } };

    case 'toggleSettings':
      return { ...state, settingsOpen: action.open ?? !state.settingsOpen };

    case 'resetProgress': {
      store.clear();
      const fresh = store.defaultSave();
      return {
        ...initialState(),
        save: { ...fresh, settings: state.save.settings, profile: state.save.profile },
      };
    }

    default:
      return state;
  }
}

function advancePhase(state: GameState, s: Session): GameState {
  const nextPhase = s.phaseIndex + 1;
  if (nextPhase >= s.phases.length) {
    return reducer({ ...state, session: { ...s, questionIndex: 0 } }, { type: 'finishLevel' });
  }
  return { ...state, session: { ...s, phaseIndex: nextPhase, questionIndex: 0 } };
}

/* ------------------------------------------------------------------- context */

const StateCtx = createContext<GameState | null>(null);
const DispatchCtx = createContext<Dispatch<Action> | null>(null);

export function useGameReducer() {
  return useReducer(reducer, undefined, initialState);
}

export const GameStateContext = StateCtx;
export const GameDispatchContext = DispatchCtx;

export function useGame(): GameState {
  const v = useContext(StateCtx);
  if (!v) throw new Error('useGame must be used inside <GameProvider>');
  return v;
}

export function useDispatch(): Dispatch<Action> {
  const v = useContext(DispatchCtx);
  if (!v) throw new Error('useDispatch must be used inside <GameProvider>');
  return v;
}

/**
 * Persist whenever the durable part of the state changes.
 *
 * Ordinary in-level updates (score, mastery, a settings toggle) are debounced,
 * because they happen on every answer.  Finishing a level is different: it is the
 * moment the player earns their stars, coins and unlock, so it is written
 * straight away rather than 250ms later.
 */
export function usePersist(state: GameState) {
  const initial = useRef(state.save);
  const lastLevels = useRef(state.save.progress.levels);
  useEffect(() => {
    // Nothing has changed yet on the very first render — writing here would only
    // rewrite what was just read.
    if (state.save === initial.current) return;
    if (state.save.progress.levels !== lastLevels.current) {
      lastLevels.current = state.save.progress.levels;
      store.saveNow(state.save);
      return;
    }
    store.save(state.save);
  }, [state.save]);
  useEffect(() => {
    const flush = () => store.saveNow(state.save);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [state.save]);
}

/* --------------------------------------------------------------- selectors */

export function useCompleted(): Set<string> {
  const { save } = useGame();
  return useMemo(() => completedSet(save), [save]);
}

export function useCurrentLevel(): LevelDef | null {
  const { session } = useGame();
  return session ? LEVEL_BY_ID.get(session.levelId) ?? null : null;
}

export function currentPhase(session: Session): BuiltPhase | undefined {
  return session.phases[session.phaseIndex];
}

/** Total questions in the level, for the progress bar. */
export function totalQuestions(session: Session): number {
  return session.phases.reduce((n, p) => n + Math.max(1, p.questions.length), 0);
}

export function answeredSoFar(session: Session): number {
  let n = 0;
  for (let i = 0; i < session.phaseIndex; i++) n += Math.max(1, session.phases[i].questions.length);
  return n + session.questionIndex;
}

export { nextLevelId };
