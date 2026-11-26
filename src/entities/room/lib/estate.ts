import { ESTATE_TOKENS, type EstateTokenLook } from '../config/estate-tokens';
import type { EstateCell, Player, Room } from '../model/room';

/** Where a cell lies on the 9 × 9 grid of the board, and which side of the ring it is on. */
export interface EstatePlace {
  row: number;
  column: number;
  side: 'corner' | 'bottom' | 'left' | 'top' | 'right';
}

/** The ring starts in the bottom right corner and runs clockwise as seen from the start. */
export function estatePlace(idx: number): EstatePlace {
  const side =
    idx % 8 === 0 ? 'corner' : idx < 8 ? 'bottom' : idx < 16 ? 'left' : idx < 24 ? 'top' : 'right';
  if (idx <= 8) return { row: 9, column: 9 - idx, side };
  if (idx <= 16) return { row: 9 - (idx - 8), column: 1, side };
  if (idx <= 24) return { row: 1, column: 1 + (idx - 16), side };
  return { row: 1 + (idx - 24), column: 9, side };
}

export function tokenOf(player: Pick<Player, 'turn_order'>): EstateTokenLook {
  return ESTATE_TOKENS[((player.turn_order ?? 1) - 1) % ESTATE_TOKENS.length]!;
}

/** Players still in the game, in turn order. */
export function estatePlayers(players: readonly Player[]): Player[] {
  return players
    .filter((p) => p.turn_order !== null)
    .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0));
}

export function isOwnable(cell: Pick<EstateCell, 'kind'>): boolean {
  return cell.kind === 'city' || cell.kind === 'station' || cell.kind === 'utility';
}

/** The cities of a region. */
export function regionCells(cells: readonly EstateCell[], region: number | null): EstateCell[] {
  return cells.filter((c) => c.kind === 'city' && c.region === region);
}

/** Whether one owner holds the whole region of a city. */
export function ownsRegion(cells: readonly EstateCell[], cell: EstateCell): boolean {
  return (
    cell.owner_id !== null &&
    regionCells(cells, cell.region).every((c) => c.owner_id === cell.owner_id)
  );
}

/** The rent of a cell as it stands; for a utility, per point on the dice. Mirrors `estate_rent`. */
export function rentOf(cells: readonly EstateCell[], cell: EstateCell): number {
  if (!cell.owner_id || cell.mortgaged) return 0;
  if (cell.kind === 'city') {
    const rents = cell.rents ?? [0];
    if (cell.level === 0 && ownsRegion(cells, cell)) return rents[0]! * 2;
    return rents[cell.level] ?? 0;
  }
  const count = cells.filter((c) => c.kind === cell.kind && c.owner_id === cell.owner_id).length;
  if (cell.kind === 'station') return [0, 250, 500, 1000, 2000][count] ?? 0;
  return count >= 2 ? 100 : 40;
}

/** What redeeming a mortgage costs: the loan and 10%. Mirrors `estate_redeem`. */
export function redeemCost(cell: Pick<EstateCell, 'price'>): number {
  return Math.round((cell.price * 0.55) / 10) * 10;
}

/** What a player may do with their own cell now, as the database will allow it. */
export function propertyMoves(
  cells: readonly EstateCell[],
  cell: EstateCell,
  playerId: string,
  money: number,
): { build: boolean; sell: boolean; mortgage: boolean; redeem: boolean } {
  const mine = cell.owner_id === playerId;
  const region = cell.kind === 'city' ? regionCells(cells, cell.region) : [];
  const built = region.some((c) => c.level > 0);
  return {
    build:
      mine &&
      cell.kind === 'city' &&
      cell.level < 4 &&
      money >= cell.house_cost &&
      region.every((c) => c.owner_id === playerId && !c.mortgaged && c.level >= cell.level),
    sell: mine && cell.level > 0 && region.every((c) => c.level <= cell.level),
    mortgage: mine && !cell.mortgaged && !built,
    redeem: mine && cell.mortgaged && money >= redeemCost(cell),
  };
}

/** Whose turn it is. */
export function turnPlayer(room: Room | null, players: readonly Player[]): Player | null {
  return players.find((p) => p.id === room?.estate_turn) ?? null;
}
