import type { Signal } from '@angular/core';
import type { AiOption, AiRequest, AiResult, OwnAi } from './ai-writer.types';

/**
 * What the editor needs from whoever writes questions: the choice of AI and the writing itself.
 * Features depend on this, not on how the AI is reached or where the host's AIs are kept.
 */
export abstract class QuizWriter {
  /** The chosen AI: "auto", a free provider, or "own:<id>". */
  abstract readonly provider: Signal<string>;
  abstract readonly ownAis: Signal<OwnAi[]>;
  abstract readonly options: Signal<AiOption[]>;

  abstract choose(provider: string): void;
  abstract addOwn(own: Omit<OwnAi, 'id'>): void;
  abstract removeOwn(id: string): void;
  abstract labelOf(id: string): string;
  abstract iconOf(id: string): string;
  abstract write(request: AiRequest): Promise<AiResult>;
}
