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
  | 'bluff_reveal';

export type RoomMode = 'board' | 'bluff';

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
  /** Who has written, or while voting, who has voted. */
  bluff_done: string[];
  /** The shuffled options while voting; at the reveal with their kind, author and voters. */
  bluff_options: BluffOption[] | null;
  /** What each player gained or lost in the round just revealed. */
  bluff_deltas: Record<string, number> | null;
  version: number;
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
