/**
 * The game's sound, kept in step with it (3.1.0): the volumes from Settings,
 * the music and ambience for the screen and hour, an effect when the game
 * changes or something starts to need the player, and a click on each tap.
 * What plays when is in `sound-view.ts`; `audio.ts` plays it.
 */
import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/index.ts';
import { usePrefs, useServices } from './hooks.ts';
import type { Route } from './route.ts';
import { alertCues, alertsAt, ambienceFor, musicFor, stateCues, tapCue, type Alerts } from './sound-view.ts';

export function useSound(state: GameState | null, route: Route, now: number): void {
  const { sound } = useServices();
  const { sound: on, musicVolume, effectsVolume, ambienceVolume } = usePrefs();

  useEffect(() => {
    sound.setVolumes({ on, music: musicVolume, sound: effectsVolume, ambience: ambienceVolume });
  }, [sound, on, musicVolume, effectsVolume, ambienceVolume]);

  // Phones only let sound start from a touch (a finger lifting counts, a finger landing doesn't); every tap after that clicks.
  useEffect(() => {
    const unlock = (): void => sound.unlock();
    const onClick = (e: MouseEvent): void => {
      sound.unlock();
      const cue = tapCue(e.target instanceof Element ? e.target : null);
      if (cue) sound.play(cue);
    };
    const events = ['pointerup', 'touchend', 'keydown'] as const;
    for (const ev of events) document.addEventListener(ev, unlock, true);
    document.addEventListener('click', onClick, true);
    return () => {
      for (const ev of events) document.removeEventListener(ev, unlock, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [sound]);

  const hour = new Date(now).getHours();
  const music = state ? musicFor(route, state, hour) : null;
  useEffect(() => {
    sound.setMusic(music);
  }, [sound, music]);

  const ambience = state ? ambienceFor(route, state, hour) : null;
  const ambienceKey = ambience ? Object.values(ambience).join(',') : '';
  useEffect(() => {
    if (ambience) sound.setAmbience(ambience);
    // The mix only matters when its numbers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, ambienceKey]);

  // Something changed in the game.
  const last = useRef<GameState | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = state;
    if (before && state && before !== state) for (const cue of stateCues(before, state)) sound.play(cue);
  }, [sound, state]);

  // Something started to need the player while they were looking.
  const alerts = useRef<Alerts | null>(null);
  useEffect(() => {
    if (!state) return;
    const now2 = alertsAt(state, now);
    const before = alerts.current;
    alerts.current = now2;
    if (before) for (const cue of alertCues(before, now2)) sound.play(cue);
  }, [sound, state, now]);
}
