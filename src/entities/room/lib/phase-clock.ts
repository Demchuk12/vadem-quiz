import type { Room } from '../model/room';

/** Whole seconds left until `endsAt`; 0 once it is over or when the phase has no clock. */
export function secondsLeft(endsAt: number | null, now: number): number {
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** The clock of the room's current state: presses in "Своя гра", writing and voting in "Варіанти". */
export function phaseSeconds(room: Room): number | null {
  switch (room.state) {
    case 'buzzing_open':
      return room.buzz_seconds;
    case 'bluff_writing':
      return room.writing_seconds;
    case 'bluff_voting':
      return room.voting_seconds;
    default:
      return null;
  }
}

/**
 * When the current phase ends, on this device's clock. A device's clock may be seconds off the
 * database's, so a phase seen to begin runs its full length from that moment; only a page opened
 * mid-phase has to trust the database's end time.
 */
export class PhaseClock {
  private phase: string | null = null;
  private endsAt: number | null = null;

  observe(room: Room | null, now: number): number | null {
    if (!room) return null;
    const phase = `${room.round}:${room.state}`;
    if (phase !== this.phase) {
      const seenStarting = this.phase !== null;
      this.phase = phase;
      const seconds = phaseSeconds(room);
      this.endsAt =
        seconds === null || !room.phase_ends_at
          ? null
          : seenStarting
            ? now + seconds * 1000
            : Date.parse(room.phase_ends_at);
    }
    return this.endsAt;
  }
}
