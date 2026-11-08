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

/** What proves a call comes from the host of a room. */
export interface HostKey {
  roomId: string;
  token: string;
}
