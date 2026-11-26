import type { Room } from '../model/room';

/** An auction runs this long after its last bid; the database says the same. */
export const ESTATE_AUCTION_SECONDS = 10;

/** Whole seconds left until `endsAt`; 0 once it is over or when the phase has no clock. */
export function secondsLeft(endsAt: number | null, now: number): number {
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** The clock of the room's current state, in seconds; null in one without a clock. */
export function phaseSeconds(room: Room): number | null {
  switch (room.state) {
    case 'buzzing_open':
      return room.buzz_seconds;
    case 'bluff_writing':
      return room.writing_seconds;
    case 'bluff_voting':
      return room.voting_seconds;
    case 'guess_open':
      return room.guess_seconds;
    case 'estate_playing':
      return room.estate_step === 'auction' ? ESTATE_AUCTION_SECONDS : room.estate_turn_seconds;
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
    // A "Господар" turn has a clock for each step, and a bid restarts the auction's.
    const phase =
      room.state === 'estate_playing'
        ? `${room.state}:${room.estate_turn}:${room.estate_step}:${room.phase_ends_at}`
        : `${room.round}:${room.state}`;
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
