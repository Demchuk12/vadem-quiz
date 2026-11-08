import type { Provider } from '@angular/core';
import { AiSettings } from './ai-settings';
import { AiWriter } from './ai-writer';
import { BrowserAiSettings } from './browser-ai-settings';
import { QuizWriter } from './quiz-writer';

/** Wires the question writer to its implementations; the app picks them in one place. */
export function provideAiWriting(): Provider[] {
  return [
    { provide: AiSettings, useClass: BrowserAiSettings },
    { provide: QuizWriter, useClass: AiWriter },
  ];
}
