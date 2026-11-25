import { GUESS_LENGTHS, GUESS_QUESTIONS, GUESS_SECONDS } from '../config/guess-limits';
import type { GuessDocument, GuessQuestion } from './guess-document.types';
import type { GeneratedRound, QuizProgress } from './quiz-document.types';

const emptyGuess = (): GuessQuestion => ({ text: '', answer: null, unit: '', explanation: '' });

export function emptyGuessQuiz(title: string): GuessDocument {
  return {
    title,
    mode: 'guess',
    guesses: Array.from({ length: GUESS_QUESTIONS.default }, emptyGuess),
    guessSeconds: GUESS_SECONDS,
  };
}

export const isGuessComplete = (question: GuessQuestion): boolean =>
  question.text.trim() !== '' && question.answer !== null;

export function guessProgress(doc: GuessDocument): QuizProgress {
  return {
    complete: doc.guesses.filter(isGuessComplete).length,
    total: doc.guesses.length,
    missingTitles: 0,
  };
}

export function updateGuess(
  doc: GuessDocument,
  index: number,
  patch: Partial<GuessQuestion>,
): GuessDocument {
  return {
    ...doc,
    guesses: doc.guesses.map((guess, i) => (i === index ? { ...guess, ...patch } : guess)),
  };
}

export function addGuess(doc: GuessDocument): GuessDocument {
  if (doc.guesses.length >= GUESS_QUESTIONS.max) return doc;
  return { ...doc, guesses: [...doc.guesses, emptyGuess()] };
}

export function removeGuess(doc: GuessDocument, index: number): GuessDocument {
  return { ...doc, guesses: doc.guesses.filter((_, i) => i !== index) };
}

/** The AI's questions replace the quiz's. The function has checked that the answers are numbers. */
export function applyGeneratedGuesses(doc: GuessDocument, round: GeneratedRound): GuessDocument {
  return {
    ...doc,
    guesses: (round.categories[0]?.questions ?? []).map((question) => {
      const answer = Number(question.answer);
      return {
        text: question.text.slice(0, GUESS_LENGTHS.text),
        answer: Number.isFinite(answer) ? answer : null,
        unit: (question.unit ?? '').slice(0, GUESS_LENGTHS.unit),
        explanation: question.explanation ?? '',
      };
    }),
  };
}
