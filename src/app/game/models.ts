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
  buzz_winner_player_id: string | null;
  spent_player_ids: string[];
  version: number;
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
