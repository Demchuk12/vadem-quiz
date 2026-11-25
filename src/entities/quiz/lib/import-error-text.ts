import { injectMessages } from '@shared/i18n';
import { MESSAGES } from '../i18n/messages';
import type { QuizImportError } from '../model/quiz-import-error';

/** Tells the host what is wrong with a file, in the app's language. Injection context. */
export function injectImportErrorText(): (error: QuizImportError) => string {
  const t = injectMessages(MESSAGES);
  return ({ problem, place }) => {
    const { importProblem, importPlace } = t();
    return place ? `${importPlace(place)}: ${importProblem[problem]}` : importProblem[problem];
  };
}
