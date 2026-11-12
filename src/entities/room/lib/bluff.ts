import type { BluffOption, Player, Room } from '../model/room';

/**
 * What makes two options the same words, as the database decides it (`private.bluff_key`): case,
 * quotes, extra spaces and a closing full stop aside.
 */
export function bluffKey(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\s.!…]+$/u, '')
    .replace(/[«»"'’„“]/g, '')
    .toLowerCase();
}

/** The options a player may pick: none with the same words as their own lie. */
export function votableOptions(options: BluffOption[], ownAnswer: string | null): BluffOption[] {
  if (!ownAnswer) return options;
  const own = bluffKey(ownAnswer);
  return options.filter((option) => bluffKey(option.text) !== own);
}

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

/** The fact without the "…" it ends on, so a screen can put the blank or the truth there. */
export function factStem(text: string): string {
  return text.trim().replace(/[\s.…]+$/u, '');
}

/** One player's round, as the reveal tells it. */
export interface BluffResult {
  delta: number;
  /** The option they voted for, or null when they did not vote. */
  picked: BluffOption | null;
  /** Its author's nickname, when it was another player's lie. */
  pickedAuthor: string | null;
  /** Who fell for this player's own lie. */
  fooled: string[];
}

export function bluffResult(room: Room, players: Player[], playerId: string): BluffResult {
  const options = room.bluff_options ?? [];
  const name = (id: string | null | undefined) =>
    players.find((player) => player.id === id)?.nickname ?? 'Гравець';
  const picked = options.find((option) => option.voter_ids?.includes(playerId)) ?? null;
  return {
    delta: room.bluff_deltas?.[playerId] ?? 0,
    picked,
    pickedAuthor: picked?.kind === 'player' ? name(picked.player_id) : null,
    fooled: options
      .filter((option) => option.kind === 'player' && option.player_id === playerId)
      .flatMap((option) => option.voter_ids ?? [])
      .map(name),
  };
}

/** An option as the reveal shows it: whose it was and who fell for it. */
export interface RevealedOption {
  option: BluffOption;
  label: string;
  voters: string[];
}

/**
 * The reveal goes from the lie that fooled fewest to the one that fooled most, and ends on the
 * truth, so the room learns it last.
 */
export function revealOrder(room: Room, players: Player[]): RevealedOption[] {
  const name = (id: string | null | undefined) =>
    players.find((player) => player.id === id)?.nickname ?? 'Гравець';
  const label = (option: BluffOption) => {
    if (option.kind === 'truth') return 'Правда';
    if (option.kind === 'decoy') return 'Пастка ведучого';
    return `Варіант гравця ${name(option.player_id)}`;
  };
  const voters = (option: BluffOption) => option.voter_ids ?? [];
  return [...(room.bluff_options ?? [])]
    .sort(
      (a, b) =>
        Number(a.kind === 'truth') - Number(b.kind === 'truth') ||
        voters(a).length - voters(b).length,
    )
    .map((option) => ({ option, label: label(option), voters: voters(option).map(name) }));
}
