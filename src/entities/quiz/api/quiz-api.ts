import { Injectable, inject } from '@angular/core';
import { Rpc } from '@shared/api';
import type { QuizDocument } from '../model/quiz-document';

export interface NewQuiz {
  quiz_id: string;
  owner_token: string;
}

/** An AI that can write rounds: this deployment has its key. */
export interface AiProvider {
  id: string;
  label: string;
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
  /** A provider id, or "auto" for the first one that answers. */
  provider: string;
  /** Ask for some questions with a photo from Wikipedia. */
  images: boolean;
}

/** As the AI wrote it. A question's `imageUrl` is a photo still to be stored with the quiz. */
export interface GeneratedRoundResult {
  provider: string;
  categories: {
    title: string;
    questions: { text: string; answer: string; imageUrl?: string }[];
  }[];
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

  aiProviders(): Promise<AiProvider[]> {
    return this.rpc
      .invoke<{ providers: AiProvider[] }>('generate-round')
      .then((result) => result.providers);
  }

  generateRound(request: GenerateRoundRequest): Promise<GeneratedRoundResult> {
    return this.rpc.invoke('generate-round', { ...request });
  }
}
