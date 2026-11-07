import { Injectable, inject } from '@angular/core';
import { Rpc } from '@shared/api';
import type { GeneratedRound, QuizDocument } from '../model/quiz-document';

export interface NewQuiz {
  quiz_id: string;
  owner_token: string;
}

export interface GenerateRoundRequest {
  quizId: string;
  token: string;
  prompt: string;
  /** Counted from 1. */
  round: number;
  roundCount: number;
  categories: number;
  questions: number;
  /** Category titles already used by earlier rounds. */
  avoid: string[];
}

@Injectable({ providedIn: 'root' })
export class QuizApi {
  private readonly rpc = inject(Rpc);

  create(title: string): Promise<NewQuiz> {
    return this.rpc.callRow('create_quiz', { p_title: title });
  }
  get(quizId: string, token: string): Promise<QuizDocument> {
    return this.rpc.call('get_quiz', { p_quiz_id: quizId, p_token: token });
  }
  save(quizId: string, token: string, document: QuizDocument): Promise<void> {
    return this.rpc.call('save_quiz', { p_quiz_id: quizId, p_token: token, p_document: document });
  }
  delete(quizId: string, token: string): Promise<void> {
    return this.rpc.call('delete_quiz', { p_quiz_id: quizId, p_token: token });
  }

  generateRound(request: GenerateRoundRequest): Promise<GeneratedRound> {
    return this.rpc.invoke('generate-round', { ...request });
  }
}
