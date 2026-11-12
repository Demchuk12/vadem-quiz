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

/** Whole seconds left in the phase; 0 once it is over or when it has no clock. */
export function secondsLeft(room: Pick<Room, 'phase_ends_at'>, now: number): number {
  if (!room.phase_ends_at) return 0;
  return Math.max(0, Math.ceil((Date.parse(room.phase_ends_at) - now) / 1000));
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
