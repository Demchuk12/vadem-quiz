import { bluffProgress, emptyBluffQuiz } from './bluff-document';
import { emptyGuessQuiz, guessProgress } from './guess-document';
import { emptyQuiz, quizProgress } from './quiz-document';
import type { QuizProgress } from './quiz-document.types';
import type { AnyQuizDocument, QuizDocuments, QuizMode } from './quiz-kind.types';

/** What every game's quiz can do, whatever it holds. */
const KINDS: {
  [M in QuizMode]: {
    empty(title: string): QuizDocuments[M];
    progress(document: QuizDocuments[M]): QuizProgress;
  };
} = {
  board: { empty: emptyQuiz, progress: quizProgress },
  bluff: { empty: emptyBluffQuiz, progress: bluffProgress },
  guess: { empty: emptyGuessQuiz, progress: guessProgress },
};

/** A document without a mode is a board: there was only one game once. */
export function kindOf(document: AnyQuizDocument): QuizMode {
  return (document as { mode?: QuizMode }).mode ?? 'board';
}

/** The document, when it is of this kind. */
export function asKind<M extends QuizMode>(
  document: AnyQuizDocument | null,
  mode: M,
): QuizDocuments[M] | null {
  return document && kindOf(document) === mode ? (document as QuizDocuments[M]) : null;
}

export function emptyDocument(mode: QuizMode, title: string): AnyQuizDocument {
  return KINDS[mode].empty(title);
}

export function documentProgress(document: AnyQuizDocument): QuizProgress {
  const kind = KINDS[kindOf(document)] as { progress(document: AnyQuizDocument): QuizProgress };
  return kind.progress(document);
}
