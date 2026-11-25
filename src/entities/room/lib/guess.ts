import type { GuessResult, Player, Room } from '../model/room';

/** One row of the reveal. */
export interface GuessRow extends GuessResult {
  nickname: string;
  distance: number;
  /** Where the value stands against the answer, from -1 to 1. */
  position: number;
}

/** The answer of the question, once revealed. */
export const guessAnswer = (room: Room): number | null =>
  room.answer_text === null ? null : Number(room.answer_text);

export const isFinalGuess = (room: Room): boolean => room.round >= room.round_count;

/**
 * Places values around the answer, from -1 to 1. A typical miss stands halfway to the edge and far
 * ones crowd toward it, so one answer off by a billion does not push the others into one point.
 */
export function scalePositions(answer: number, values: readonly number[]): number[] {
  const offsets = values.map((value) => value - answer);
  const misses = offsets
    .map(Math.abs)
    .filter((miss) => miss > 0)
    .sort((a, b) => a - b);
  if (misses.length === 0) return offsets.map(() => 0);
  const typical = misses[Math.floor((misses.length - 1) / 2)]!;
  const squeezed = offsets.map((offset) => offset / (Math.abs(offset) + typical));
  const widest = Math.max(...squeezed.map(Math.abs));
  return squeezed.map((offset) => offset / widest);
}

/** Everyone who answered, closest first. Empty before the reveal. */
export function guessRows(room: Room, players: readonly Player[]): GuessRow[] {
  const answer = guessAnswer(room);
  const results = room.guess_results;
  if (answer === null || !results) return [];
  const positions = scalePositions(
    answer,
    results.map((result) => result.value),
  );
  return results.map((result, index) => ({
    ...result,
    nickname: players.find((player) => player.id === result.player_id)?.nickname ?? '—',
    distance: Math.abs(result.value - answer),
    position: positions[index]!,
  }));
}
