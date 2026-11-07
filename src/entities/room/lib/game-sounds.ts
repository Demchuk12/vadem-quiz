import { effect } from '@angular/core';
import type { Sound } from '@shared/lib';
import type { RoomState } from '../model/room';
import type { RoomStore } from '../model/room-store';

/** Plays a cue for each press and each verdict. Call in a constructor (injection context). */
export function playGameSounds(store: RoomStore, sound: Sound): void {
  let previous: RoomState | undefined;
  effect(() => {
    const state = store.room()?.state;
    if (previous !== undefined && state !== previous && state === 'buzzed') sound.play('buzz');
    previous = state;
  });
  // From verdicts, not states: skipping a question reveals the answer too, and is not "correct".
  effect(() => {
    const verdict = store.verdict();
    if (verdict) sound.play(verdict.correct ? 'correct' : 'wrong');
  });
}
