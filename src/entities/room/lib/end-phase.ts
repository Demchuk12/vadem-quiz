import { DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import type { RoomState } from '../model/room';
import { RoomStore } from '../model/room-store';
import { secondsLeft } from './phase-clock';

const TICK_MS = 500;

/**
 * Ends a phase whose clock has run out, once. There is no server of our own, so the host's page
 * does it. The players may have ended the phase a moment earlier: then there is nothing to report.
 * Injection context.
 */
export function endPhaseOnTime(
  states: readonly RoomState[],
  end: (state: RoomState) => Promise<unknown>,
): void {
  const store = inject(RoomStore);
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), TICK_MS);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));

  let ended: number | null = null;
  effect(() => {
    const state = store.room()?.state;
    const endsAt = store.phaseEndsAt();
    if (!state || !states.includes(state) || endsAt === null || endsAt === ended) return;
    if (secondsLeft(endsAt, now()) > 0) return;
    ended = endsAt;
    untracked(() => void end(state).catch(() => undefined));
  });
}
