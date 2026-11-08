export type RoomState =
  | 'lobby'
  | 'board'
  | 'question_shown'
  | 'buzzing_open'
  | 'buzzed'
  | 'answer_shown'
  | 'round_end'
  | 'finished';

/** Row of `public.rooms`: the whole visible state of one game. */
export interface Room {
  id: string;
  code: string;
  quiz_title: string;
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
  version: number;
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
