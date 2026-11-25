import type { RoomMode } from '../model/room';

/** How many players a game needs to start. The database checks the same. */
export const MIN_PLAYERS: Record<RoomMode, number> = { board: 1, bluff: 3, guess: 2 };
