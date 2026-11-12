export interface NewRoom {
  room_id: string;
  room_code: string;
  host_token: string;
}

export interface JoinedRoom {
  room_id: string;
  player_id: string;
  player_token: string;
}

export interface HostAnswer {
  answer_text: string;
  answer_image_path: string | null;
  explanation: string;
}

/** The truth and the decoy of the current fact, for the host alone. */
export interface BluffHostFact {
  truth: string;
  decoy: string;
  explanation: string;
}

/** A player's own part of the round: their lie and their vote, if any. */
export interface BluffMyRound {
  answer: string | null;
  option_id: string | null;
}

/** What proves a call comes from the host of a room. */
export interface HostKey {
  roomId: string;
  token: string;
}
