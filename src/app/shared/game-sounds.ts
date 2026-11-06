import { effect } from '@angular/core';
import type { Sound } from '../core/sound';
import type { RoomState } from '../game/models';
import type { RoomStore } from '../game/room-store';

/** Plays a cue for each transition. Call in a constructor (injection context). */
export function playGameSounds(store: RoomStore, sound: Sound): void {
  let previous: RoomState | undefined;
  effect(() => {
    const state = store.room()?.state;
    if (previous !== undefined && state !== previous) {
      if (state === 'buzzed') sound.play('buzz');
      else if (previous === 'buzzed' && state === 'buzzing_open') sound.play('wrong');
      else if (previous === 'buzzed' && state === 'answer_shown') sound.play('correct');
    }
    previous = state;
  });
}
