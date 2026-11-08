import { Injectable, inject } from '@angular/core';
import { Rpc } from '@shared/api';
import type { HostAnswer, HostKey, JoinedRoom, NewRoom } from './room-api.types';

/** The game's database functions (see supabase/migrations). */
@Injectable({ providedIn: 'root' })
export class RoomApi {
  private readonly rpc = inject(Rpc);

  private hostCall<T>(fn: string, key: HostKey, args: Record<string, unknown> = {}): Promise<T> {
    return this.rpc.call(fn, { p_room_id: key.roomId, p_token: key.token, ...args });
  }

  create(quizId: string, quizToken: string): Promise<NewRoom> {
    return this.rpc.callRow('create_room', { p_quiz_id: quizId, p_quiz_token: quizToken });
  }
  isHost(key: HostKey): Promise<boolean> {
    return this.hostCall('is_room_host', key);
  }

  join(code: string, nickname: string): Promise<JoinedRoom> {
    return this.rpc.callRow('join_room', { p_code: code, p_nickname: nickname });
  }
  isPlayer(playerId: string, token: string): Promise<boolean> {
    return this.rpc.call('is_room_player', { p_player_id: playerId, p_token: token });
  }
  buzz(roomId: string, playerId: string, token: string): Promise<boolean> {
    return this.rpc.call('buzz', { p_room_id: roomId, p_player_id: playerId, p_token: token });
  }

  startGame(key: HostKey): Promise<void> {
    return this.hostCall('start_game', key);
  }
  openQuestion(key: HostKey, cellId: string): Promise<void> {
    return this.hostCall('open_question', key, { p_cell_id: cellId });
  }
  openBuzz(key: HostKey): Promise<void> {
    return this.hostCall('open_buzz', key);
  }
  async hostAnswer(key: HostKey): Promise<HostAnswer | null> {
    const rows = await this.hostCall<HostAnswer[]>('host_answer', key);
    return rows[0] ?? null;
  }
  judge(key: HostKey, correct: boolean): Promise<void> {
    return this.hostCall('judge', key, { p_correct: correct });
  }
  skipQuestion(key: HostKey): Promise<void> {
    return this.hostCall('skip_question', key);
  }
  returnToBoard(key: HostKey): Promise<void> {
    return this.hostCall('return_to_board', key);
  }
  nextRound(key: HostKey): Promise<void> {
    return this.hostCall('next_round', key);
  }
  finishGame(key: HostKey): Promise<void> {
    return this.hostCall('finish_game', key);
  }
  adjustScore(key: HostKey, playerId: string, delta: number): Promise<void> {
    return this.hostCall('adjust_score', key, { p_player_id: playerId, p_delta: delta });
  }
}
