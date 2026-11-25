import { inject } from '@angular/core';
import { I18n } from '@shared/i18n';
import { formatDelay, formatScore } from './game-logic';

/** Scores in the app's language. Injection context; the result reads the language when called. */
export function injectScoreFormat(): (score: number) => string {
  const { locale } = inject(I18n);
  return (score) => formatScore(score, locale());
}

/** How late a press was, in the app's language. Injection context. */
export function injectDelayFormat(): (ms: number) => string {
  const { locale } = inject(I18n);
  return (ms) => formatDelay(ms, locale());
}
