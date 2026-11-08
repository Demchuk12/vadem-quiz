import { Injectable, computed, inject, signal } from '@angular/core';
import { Media } from '@shared/api';
import { readJson, writeJson } from '@shared/lib';
import type { GeneratedRound } from '../model/quiz-document';
import {
  QuizApi,
  type AiProvider,
  type AiVendor,
  type GenerateRoundRequest,
  type OwnAiCredentials,
} from './quiz-api';

const CHOICE_KEY = 'vq.ai-provider';
const OWN_KEY = 'vq.own-ai';
const OWN_PREFIX = 'own:';

export type AiRequest = Omit<GenerateRoundRequest, 'provider' | 'own'>;

export interface AiResult {
  round: GeneratedRound;
  /** The name of the AI that wrote it, as the host knows it. */
  writer: string;
}

/** A host's own AI, kept in this browser only. */
export interface OwnAi extends OwnAiCredentials {
  id: string;
  modelLabel: string;
}

/** One line of the "who writes" choice. */
export interface AiOption {
  id: string;
  label: string;
  /** Which mark to show: a vendor, a free provider, or "auto". */
  icon: string;
}

export const VENDOR_LABELS: Record<AiVendor, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
};

/**
 * Everything that asks the AI goes through here: one choice of AI for the whole editor,
 * remembered on this device, and photos stored with the quiz the same way every time.
 * The host's own AIs, keys included, live in this browser's storage and nowhere else.
 */
@Injectable({ providedIn: 'root' })
export class AiWriter {
  private readonly api = inject(QuizApi);
  private readonly media = inject(Media);

  /** Only the free AIs this deployment has keys for. */
  readonly providers = signal<AiProvider[]>([]);
  readonly ownAis = signal<OwnAi[]>(readJson<OwnAi[]>(OWN_KEY) ?? []);
  readonly provider = signal<string>(readJson<string>(CHOICE_KEY) ?? 'auto');

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
    this.provider.set(provider);
    writeJson(CHOICE_KEY, provider);
  }

  addOwn(own: Omit<OwnAi, 'id'>): void {
    const added = { ...own, id: crypto.randomUUID() };
    this.saveOwn([...this.ownAis(), added]);
    this.choose(OWN_PREFIX + added.id);
  }

  removeOwn(id: string): void {
    this.saveOwn(this.ownAis().filter((own) => own.id !== id));
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

  private saveOwn(ais: OwnAi[]): void {
    this.ownAis.set(ais);
    writeJson(OWN_KEY, ais);
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
