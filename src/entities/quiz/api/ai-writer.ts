import { Injectable, computed, inject, signal } from '@angular/core';
import { Media } from '@shared/api';
import { AiSettings } from './ai-settings';
import { QuizApi } from './quiz-api';
import { QuizWriter } from './quiz-writer';
import type { AiOption, AiRequest, AiResult, OwnAi } from './ai-writer.types';
import type { AiProvider } from './quiz-api.types';
import { VENDOR_LABELS } from '../config/ai-vendors';
import type { GeneratedRound } from '../model/quiz-document.types';

const OWN_PREFIX = 'own:';

/**
 * Writes through the generate-round function: one choice of AI for the whole editor, kept by
 * `AiSettings`, and photos stored with the quiz the same way every time.
 */
@Injectable()
export class AiWriter implements QuizWriter {
  private readonly api = inject(QuizApi);
  private readonly media = inject(Media);
  private readonly settings = inject(AiSettings);

  /** Only the free AIs this deployment has keys for. */
  private readonly providers = signal<AiProvider[]>([]);
  readonly ownAis = this.settings.ownAis;
  readonly provider = this.settings.choice;

  readonly options = computed<AiOption[]>(() => [
    { id: 'auto', label: 'Авто', icon: 'auto' },
    ...this.ownAis().map((own) => ({
      id: OWN_PREFIX + own.id,
      // "Claude Sonnet" already says whose it is; "gpt-5" does not.
      label: own.modelLabel.toLowerCase().includes(VENDOR_LABELS[own.vendor].toLowerCase())
        ? own.modelLabel
        : `${VENDOR_LABELS[own.vendor]} · ${own.modelLabel}`,
      icon: own.vendor,
    })),
    ...this.providers().map((provider) => ({ ...provider, icon: provider.id })),
  ]);

  constructor() {
    this.api
      .aiProviders()
      .then((providers) => {
        this.providers.set(providers);
        if (!this.options().some((option) => option.id === this.provider())) this.choose('auto');
      })
      .catch(() => this.providers.set([]));
  }

  choose(provider: string): void {
    this.settings.saveChoice(provider);
  }

  addOwn(own: Omit<OwnAi, 'id'>): void {
    const added = { ...own, id: crypto.randomUUID() };
    this.settings.saveOwn([...this.ownAis(), added]);
    this.choose(OWN_PREFIX + added.id);
  }

  removeOwn(id: string): void {
    this.settings.saveOwn(this.ownAis().filter((own) => own.id !== id));
    if (this.provider() === OWN_PREFIX + id) this.choose('auto');
  }

  labelOf(id: string): string {
    return this.options().find((option) => option.id === id)?.label ?? id;
  }

  iconOf(id: string): string {
    return this.options().find((option) => option.id === id)?.icon ?? 'auto';
  }

  async write(request: AiRequest): Promise<AiResult> {
    const chosen = this.provider();
    const own = chosen.startsWith(OWN_PREFIX)
      ? this.ownAis().filter((ai) => OWN_PREFIX + ai.id === chosen)
      : chosen === 'auto'
        ? this.ownAis()
        : [];
    const result = await this.api.generateRound({
      ...request,
      provider: chosen.startsWith(OWN_PREFIX) ? 'own' : chosen,
      own: own.map(({ vendor, key, model }) => ({ vendor, key, model })),
    });
    // "own:N" names the Nth AI sent with this request.
    const ownIndex = result.provider.startsWith(OWN_PREFIX)
      ? Number(result.provider.slice(OWN_PREFIX.length))
      : -1;
    const writer = own[ownIndex]
      ? this.labelOf(OWN_PREFIX + own[ownIndex].id)
      : this.labelOf(result.provider);
    return { round: await this.storeImages(request.quizId, result), writer };
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
