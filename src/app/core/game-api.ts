import { Injectable, inject } from '@angular/core';
import type { QuizDocument } from '../game/quiz-document';
import { ApiError } from './api-error';
import { SUPABASE } from './supabase';

export interface NewQuiz {
  quiz_id: string;
  owner_token: string;
}
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
}

/** Every change to the game goes through these database functions (see supabase/migrations). */
@Injectable({ providedIn: 'root' })
export class GameApi {
  private readonly supabase = inject(SUPABASE);

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(fn, args);
    if (error) {
      // Functions raise their code as the message (SQLSTATE P0001); anything else is transport.
      throw new ApiError(error.code === 'P0001' ? error.message : 'network');
    }
    return data as T;
  }

  private async callRow<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const rows = await this.call<T[]>(fn, args);
    const row = rows[0];
    if (!row) throw new ApiError('network');
    return row;
  }

  createQuiz(title: string): Promise<NewQuiz> {
    return this.callRow('create_quiz', { p_title: title });
  }
  getQuiz(quizId: string, token: string): Promise<QuizDocument> {
    return this.call('get_quiz', { p_quiz_id: quizId, p_token: token });
  }
  saveQuiz(quizId: string, token: string, document: QuizDocument): Promise<void> {
    return this.call('save_quiz', { p_quiz_id: quizId, p_token: token, p_document: document });
  }
  deleteQuiz(quizId: string, token: string): Promise<void> {
    return this.call('delete_quiz', { p_quiz_id: quizId, p_token: token });
  }

  createRoom(quizId: string, quizToken: string): Promise<NewRoom> {
    return this.callRow('create_room', { p_quiz_id: quizId, p_quiz_token: quizToken });
  }
  isRoomHost(roomId: string, token: string): Promise<boolean> {
    return this.call('is_room_host', { p_room_id: roomId, p_token: token });
  }

  joinRoom(code: string, nickname: string): Promise<JoinedRoom> {
    return this.callRow('join_room', { p_code: code, p_nickname: nickname });
  }
  isRoomPlayer(playerId: string, token: string): Promise<boolean> {
    return this.call('is_room_player', { p_player_id: playerId, p_token: token });
  }
  buzz(roomId: string, playerId: string, token: string): Promise<boolean> {
    return this.call('buzz', { p_room_id: roomId, p_player_id: playerId, p_token: token });
  }

  startGame(roomId: string, token: string): Promise<void> {
    return this.call('start_game', { p_room_id: roomId, p_token: token });
  }
  openQuestion(roomId: string, token: string, cellId: string): Promise<void> {
    return this.call('open_question', { p_room_id: roomId, p_token: token, p_cell_id: cellId });
  }
  openBuzz(roomId: string, token: string): Promise<void> {
    return this.call('open_buzz', { p_room_id: roomId, p_token: token });
  }
  async hostAnswer(roomId: string, token: string): Promise<HostAnswer | null> {
    const rows = await this.call<HostAnswer[]>('host_answer', {
      p_room_id: roomId,
      p_token: token,
    });
    return rows[0] ?? null;
  }
  judge(roomId: string, token: string, correct: boolean): Promise<void> {
    return this.call('judge', { p_room_id: roomId, p_token: token, p_correct: correct });
  }
  skipQuestion(roomId: string, token: string): Promise<void> {
    return this.call('skip_question', { p_room_id: roomId, p_token: token });
  }
  returnToBoard(roomId: string, token: string): Promise<void> {
    return this.call('return_to_board', { p_room_id: roomId, p_token: token });
  }
  nextRound(roomId: string, token: string): Promise<void> {
    return this.call('next_round', { p_room_id: roomId, p_token: token });
  }
  finishGame(roomId: string, token: string): Promise<void> {
    return this.call('finish_game', { p_room_id: roomId, p_token: token });
  }
  adjustScore(roomId: string, token: string, playerId: string, delta: number): Promise<void> {
    return this.call('adjust_score', {
      p_room_id: roomId,
      p_token: token,
      p_player_id: playerId,
      p_delta: delta,
    });
  }
}
