import { useEffect } from 'react';
import {
  GameDispatchContext, GameStateContext, useGame, useGameReducer, usePersist,
} from './game/state';
import { musicPlaying, setSoundEnabled, startMusic, stopMusic, unlockAudio } from './game/audio';
import { HomeScreen } from './screens/HomeScreen';
import { MapScreen } from './screens/MapScreen';
import { WorldScreen } from './screens/WorldScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultScreen } from './screens/ResultScreen';
import { FailScreen } from './screens/FailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { HowToScreen } from './screens/HowToScreen';
import { SettingsModal } from './screens/SettingsModal';

export default function App() {
  const [state, dispatch] = useGameReducer();
  usePersist(state);

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        <Shell />
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

function Shell() {
  const state = useGame();
  const { lang, sound, music, reducedMotion, highContrast } = state.save.settings;

  // Document-level language, direction and accessibility flags.
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
  }, [highContrast]);

  useEffect(() => { setSoundEnabled(sound); }, [sound]);

  useEffect(() => {
    if (music && sound) startMusic();
    else if (musicPlaying()) stopMusic();
  }, [music, sound]);

  // Browsers hold audio until the first gesture; take the first one we get.
  useEffect(() => {
    const go = () => unlockAudio();
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
  }, []);

  // A lost run takes over the play screen, whatever phase it happened in.
  const screen = state.session?.status === 'lost' && state.screen === 'play' ? 'fail' : state.screen;

  return (
    <div className="app">
      {screen === 'home' && <HomeScreen />}
      {screen === 'map' && <MapScreen />}
      {screen === 'world' && <WorldScreen />}
      {screen === 'play' && <PlayScreen />}
      {screen === 'result' && <ResultScreen />}
      {screen === 'fail' && <FailScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'howto' && <HowToScreen />}
      {state.settingsOpen && <SettingsModal />}
    </div>
  );
}
