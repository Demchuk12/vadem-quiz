import { Injectable, inject } from '@angular/core';
import { Rpc } from '@shared/api';
import type {
  AiModel,
  AiProvider,
  AiVendor,
  GenerateRoundRequest,
  GeneratedRoundResult,
  NewQuiz,
} from './quiz-api.types';
import type { QuizDocument } from '../model/quiz-document.types';

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

  /** The chat models a key can use. The key only passes through the function. */
  aiModels(vendor: AiVendor, key: string): Promise<AiModel[]> {
    return this.rpc
      .invoke<{ models: AiModel[] }>('generate-round', { action: 'models', vendor, key })
      .then((result) => result.models);
  }

  generateRound(request: GenerateRoundRequest): Promise<GeneratedRoundResult> {
    return this.rpc.invoke('generate-round', { ...request });
  }
}
