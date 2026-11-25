import type { BluffDocument } from './bluff-document.types';
import type { GuessDocument } from './guess-document.types';
import type { QuizDocument } from './quiz-document.types';

/** A document of each game, as `get_quiz` returns it. */
export interface QuizDocuments {
  board: QuizDocument;
  bluff: BluffDocument;
  guess: GuessDocument;
}

/** Which game a quiz is for. */
export type QuizMode = keyof QuizDocuments;

export type AnyQuizDocument = QuizDocuments[QuizMode];
