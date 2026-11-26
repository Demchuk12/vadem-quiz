/** What a card of "Доля" or "Громада" does. The database checks the same ranges. */
export type EstateEffect =
  /** The bank pays the player, or the player the bank when negative. */
  | { kind: 'money'; amount: number }
  /** Every other player pays the player, or the player each of them when negative. */
  | { kind: 'each'; amount: number }
  /** The player pays for each house and each manor they own. */
  | { kind: 'repairs'; house: number; manor: number }
  /** Forward to a cell, past the start for the salary. */
  | { kind: 'move'; to: number }
  | { kind: 'back'; steps: number }
  /** Straight to the queue. */
  | { kind: 'cnap' };

export type EstateEffectKind = EstateEffect['kind'];

export interface EstateCard {
  text: string;
  effect: EstateEffect;
}

export type EstateDeck = 'fate' | 'community';

/** How the game ends: after laps, after minutes, or when one player is left. */
export type EstateEnd = 'laps' | 'minutes' | 'last';

/** What a cell of the ring is. Fixed: a quiz only names the cells. */
export type EstateCellKind =
  | 'start'
  | 'city'
  | 'community'
  | 'tax'
  | 'station'
  | 'fate'
  | 'utility'
  | 'cnap'
  | 'rest'
  | 'summons';

export interface EstateCellLayout {
  kind: EstateCellKind;
  /** A city's region, 0 to 7. */
  region?: number;
  /** The price of land; 0 for cells nobody owns. */
  price: number;
}

/** A "Господар" quiz: the names of the ring, the cards and the settings. */
export interface EstateDocument {
  title: string;
  mode: 'estate';
  /** Eight names, in the order of the ring. */
  regions: string[];
  /** Thirty-two names, from the start on. */
  cells: string[];
  fate: EstateCard[];
  community: EstateCard[];
  startMoney: number;
  endKind: EstateEnd;
  /** Laps or minutes; 0 when the game goes on to the last player. */
  endValue: number;
  /** Seconds for each step of a turn; null means no clock. */
  turnSeconds: number | null;
}
