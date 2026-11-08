import { Injectable, signal } from '@angular/core';
import { readJson, writeJson } from '@shared/lib';
import { AiSettings } from './ai-settings';
import type { OwnAi } from './ai-writer.types';

const CHOICE_KEY = 'vq.ai-provider';
const OWN_KEY = 'vq.own-ai';

/** Keeps the settings in this browser's storage, keys included, and nowhere else. */
@Injectable()
export class BrowserAiSettings implements AiSettings {
  private readonly choiceState = signal<string>(readJson<string>(CHOICE_KEY) ?? 'auto');
  private readonly ownState = signal<OwnAi[]>(readJson<OwnAi[]>(OWN_KEY) ?? []);

  readonly choice = this.choiceState.asReadonly();
  readonly ownAis = this.ownState.asReadonly();

  saveChoice(provider: string): void {
    this.choiceState.set(provider);
    writeJson(CHOICE_KEY, provider);
  }

  saveOwn(ais: OwnAi[]): void {
    this.ownState.set(ais);
    writeJson(OWN_KEY, ais);
  }
}
