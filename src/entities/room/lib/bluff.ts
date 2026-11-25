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
    players.find((player) => player.id === id)?.nickname ?? '—';
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
  /** The nickname behind a player's lie; null for the truth and the decoy. */
  author: string | null;
  voters: string[];
}

/**
 * The reveal goes from the lie that fooled fewest to the one that fooled most, and ends on the
 * truth, so the room learns it last.
 */
export function revealOrder(room: Room, players: Player[]): RevealedOption[] {
  const name = (id: string | null | undefined) =>
    players.find((player) => player.id === id)?.nickname ?? '—';
  const voters = (option: BluffOption) => option.voter_ids ?? [];
  return [...(room.bluff_options ?? [])]
    .sort(
      (a, b) =>
        Number(a.kind === 'truth') - Number(b.kind === 'truth') ||
        voters(a).length - voters(b).length,
    )
    .map((option) => ({
      option,
      author: option.kind === 'player' ? name(option.player_id) : null,
      voters: voters(option).map(name),
    }));
}
