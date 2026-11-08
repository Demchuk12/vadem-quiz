import { Injectable, inject, signal } from '@angular/core';
import { Media } from '@shared/api';
import { readJson, writeJson } from '@shared/lib';
import type { GeneratedRound } from '../model/quiz-document';
import { QuizApi, type AiProvider, type GenerateRoundRequest } from './quiz-api';

const CHOICE_KEY = 'vq.ai-provider';

export type AiRequest = Omit<GenerateRoundRequest, 'provider'>;

export interface AiResult {
  round: GeneratedRound;
  /** The name of the AI that wrote it, as the host knows it. */
  writer: string;
}

/**
 * Everything that asks the AI goes through here: one choice of AI for the whole editor,
 * remembered on this device, and photos stored with the quiz the same way every time.
 */
@Injectable({ providedIn: 'root' })
export class AiWriter {
  private readonly api = inject(QuizApi);
  private readonly media = inject(Media);

  /** Only the AIs this deployment has keys for. */
  readonly providers = signal<AiProvider[]>([]);
  readonly provider = signal<string>(readJson<string>(CHOICE_KEY) ?? 'auto');

  constructor() {
    this.api
      .aiProviders()
      .then((providers) => {
        this.providers.set(providers);
        const chosen = this.provider();
        if (chosen !== 'auto' && !providers.some((p) => p.id === chosen)) this.choose('auto');
      })
      .catch(() => this.providers.set([]));
  }

  choose(provider: string): void {
    this.provider.set(provider);
    writeJson(CHOICE_KEY, provider);
  }

  labelOf(id: string): string {
    if (id === 'auto') return 'Авто';
    return this.providers().find((provider) => provider.id === id)?.label ?? id;
  }

  async write(request: AiRequest): Promise<AiResult> {
    const result = await this.api.generateRound({ ...request, provider: this.provider() });
    return {
      round: await this.storeImages(request.quizId, result),
      writer: this.labelOf(result.provider),
    };
  }

  /** A photo that fails to arrive only costs itself: the answer reads well without it. */
  private async storeImages(
    quizId: string,
    result: Awaited<ReturnType<QuizApi['generateRound']>>,
  ): Promise<GeneratedRound> {
    return {
      categories: await Promise.all(
        result.categories.map(async (category) => ({
          title: category.title,
          questions: await Promise.all(
            category.questions.map(async ({ imageUrl, ...question }) => ({
              ...question,
              answerImagePath: imageUrl
                ? await this.media.uploadFrom(quizId, imageUrl).catch(() => null)
                : null,
            })),
          ),
        })),
      ),
    };
  }
}
