import type { Signal } from '@angular/core';
import type { OwnAi } from './ai-writer.types';

/**
 * Where the host's AI choice and own AIs are kept. Today that is this browser; tied to an account
 * later, only another implementation of this changes.
 */
export abstract class AiSettings {
  abstract readonly choice: Signal<string>;
  abstract readonly ownAis: Signal<OwnAi[]>;

  abstract saveChoice(provider: string): void;
  abstract saveOwn(ais: OwnAi[]): void;
}
