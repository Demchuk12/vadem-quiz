export type RoomState =
  | 'lobby'
  | 'board'
  | 'question_shown'
  | 'buzzing_open'
  | 'buzzed'
  | 'answer_shown'
  | 'round_end'
  | 'finished'
  // "Варіанти": players write a lie, vote for the truth, then everything is revealed.
  | 'bluff_writing'
  | 'bluff_voting'
  | 'bluff_reveal'
  // "На око": players enter a number, then everything is revealed.
  | 'guess_open'
  | 'guess_reveal'
  // "Господар": one state; what the player whose turn it is must do is `estate_step`.
  | 'estate_playing';

export type RoomMode = 'board' | 'bluff' | 'guess' | 'estate';

/** What the player whose turn it is must do now. */
export type EstateStep = 'roll' | 'decide' | 'auction' | 'debt' | 'act';

/** Row of `public.rooms`: the whole visible state of one game. */
export interface Room {
  id: string;
  code: string;
  quiz_title: string;
  mode: RoomMode;
  state: RoomState;
  round: number;
  round_count: number;
  current_cell_id: string | null;
  current_points: number | null;
  question_text: string | null;
  question_image_path: string | null;
  answer_text: string | null;
  answer_image_path: string | null;
  /** Set only once the answer is revealed, and only when the quiz has one. */
  answer_explanation: string | null;
  buzz_winner_player_id: string | null;
  /** When the winning press arrived, by the database's clock. */
  buzzed_at: string | null;
  /** The presses that came after it while the winner answers, with how late each was. */
  late_presses: LatePress[];
  spent_player_ids: string[];
  /** When the current phase's clock runs out, by the database's clock; read only in a phase with one. */
  phase_ends_at: string | null;
  /** The quiz's clocks, in seconds; null where the host moves on by hand. */
  buzz_seconds: number | null;
  writing_seconds: number | null;
  voting_seconds: number | null;
  guess_seconds: number | null;
  /** Who has written, or while voting, who has voted. */
  bluff_done: string[];
  /** The shuffled options while voting; at the reveal with their kind, author and voters. */
  bluff_options: BluffOption[] | null;
  /** What each player gained or lost in the round just revealed. */
  bluff_deltas: Record<string, number> | null;
  /** "На око": what the number counts, if anything. */
  guess_unit: string | null;
  /** Who has answered. */
  guess_done: string[];
  /** Everyone who answered, closest first; null until the reveal. */
  guess_results: GuessResult[] | null;
  /** "Господар": whose turn it is and what they must do. */
  estate_turn: string | null;
  estate_step: EstateStep | null;
  /** The last throw of the turn. */
  estate_dice: [number, number] | null;
  /** What the player owes before going on; `to` is null for the bank. */
  estate_debts: { to: string | null; amount: number }[] | null;
  estate_auction: { cell: number; bid: number; leader: string | null } | null;
  estate_regions: string[] | null;
  estate_end_kind: 'laps' | 'minutes' | 'last' | null;
  estate_ends_at: string | null;
  estate_turn_seconds: number | null;
  version: number;
}

export interface GuessResult {
  player_id: string;
  value: number;
  /** Equal distances share a place, and the next one is skipped. */
  place: number;
  delta: number;
  exact: boolean;
}

export interface BluffOption {
  id: string;
  text: string;
  /** Known only at the reveal. */
  kind?: 'truth' | 'decoy' | 'player';
  player_id?: string | null;
  voter_ids?: string[];
}

export interface LatePress {
  player_id: string;
  /** Milliseconds after the winning press. */
  ms: number;
}

/** Row of `public.players`. */
export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  joined_at: string;
  /** "Господар" only: null before the game starts. `score` is then the player's worth. */
  money: number | null;
  position: number | null;
  /** Failed throws in the queue; null outside it. */
  cnap_tries: number | null;
  bankrupt: boolean;
  /** Order of turns, from 1; also picks the player's token. */
  turn_order: number | null;
}

/** Row of `public.room_cells`: a tile, without its question. */
export interface RoomCell {
  id: string;
  room_id: string;
  round: number;
  category_position: number;
  category_title: string;
  position: number;
  points: number;
  played: boolean;
}

export interface BoardColumn {
  title: string;
  cells: RoomCell[];
}

export interface RankedPlayer {
  player: Player;
  rank: number;
}

export type PlayerBuzzerView = 'locked' | 'ready' | 'won' | 'spent';

export interface LateEntry {
  playerId: string;
  nickname: string;
  ms: number;
}

export type RoomLoadStatus = 'loading' | 'ready' | 'not_found' | 'error';

/** The host's call on an answer, as the screens celebrate or mourn it. */
export interface Verdict {
  /** New for every verdict, so the same call twice still plays twice. */
  id: number;
  correct: boolean;
  playerId: string;
  nickname: string;
  points: number;
}

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

/** Row of `public.estate_cells`: a cell of the ring with its owner. */
export interface EstateCell {
  room_id: string;
  idx: number;
  kind: EstateCellKind;
  name: string;
  region: number | null;
  price: number;
  /** A city's rent bare, with 1 to 3 houses and with a manor. */
  rents: number[] | null;
  house_cost: number;
  owner_id: string | null;
  /** 1 to 3 houses, 4 a manor. */
  level: number;
  mortgaged: boolean;
}

/** Row of `public.estate_events`: something that happened, which each screen words itself. */
export interface EstateEvent {
  id: number;
  room_id: string;
  player_id: string | null;
  code: string;
  data: Record<string, unknown>;
  created_at: string;
}

/** Row of `public.estate_offers`: `give_*` goes from `from_id` to `to_id`, `get_*` back. */
export interface EstateOffer {
  id: string;
  room_id: string;
  from_id: string;
  to_id: string;
  give_cells: number[];
  get_cells: number[];
  give_money: number;
  get_money: number;
  created_at: string;
}
