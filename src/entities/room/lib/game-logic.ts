import type { Player, Room, RoomCell } from '../model/room';

/** Room codes are shown and stored in upper case; people type them any way. */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface BoardColumn {
  title: string;
  cells: RoomCell[];
}

/** The tiles of one round, grouped into columns in the quiz's order. */
export function boardColumns(cells: readonly RoomCell[], round: number): BoardColumn[] {
  const columns = new Map<number, BoardColumn>();
  const inRound = cells
    .filter((cell) => cell.round === round)
    .sort((a, b) => a.category_position - b.category_position || a.position - b.position);
  for (const cell of inRound) {
    const column = columns.get(cell.category_position);
    if (column) column.cells.push(cell);
    else columns.set(cell.category_position, { title: cell.category_title, cells: [cell] });
  }
  return [...columns.values()];
}

export function boardRows(columns: readonly BoardColumn[]): number {
  return Math.max(1, ...columns.map((column) => column.cells.length));
}

export interface RankedPlayer {
  player: Player;
  rank: number;
}

/** Highest score first. Equal scores share a rank and the next rank skips (1, 1, 3). */
export function rankPlayers(players: readonly Player[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, 'uk'),
  );
  let rank = 0;
  return sorted.map((player, index) => {
    if (index === 0 || sorted[index - 1]!.score !== player.score) rank = index + 1;
    return { player, rank };
  });
}

const SCORE_FORMAT = new Intl.NumberFormat('uk-UA', { useGrouping: true });

/** "1 200", "−400", with a typographic minus. */
export function formatScore(score: number): string {
  return SCORE_FORMAT.format(score).replace('-', '−');
}

export type PlayerBuzzerView = 'locked' | 'ready' | 'won' | 'spent';

/** What the answer button shows to one player. The server still decides every press. */
export function buzzerStateFor(room: Room, playerId: string): PlayerBuzzerView {
  if (room.buzz_winner_player_id === playerId) return 'won';
  if (room.spent_player_ids.includes(playerId)) return 'spent';
  return room.state === 'buzzing_open' ? 'ready' : 'locked';
}

/** A wrong answer can leave nobody who may still press: the host has to move on. */
export function everyoneSpent(room: Room, players: readonly Player[]): boolean {
  return (
    room.state === 'buzzing_open' &&
    players.length > 0 &&
    players.every((player) => room.spent_player_ids.includes(player.id))
  );
}

/** Realtime events may arrive late or twice; only a newer version of a room counts. */
export function newerRoom(current: Room | null, incoming: Room): Room {
  return current && current.version > incoming.version ? current : incoming;
}

export function upsertById<T extends { id: string }>(items: readonly T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  const copy = [...items];
  copy[index] = item;
  return copy;
}
