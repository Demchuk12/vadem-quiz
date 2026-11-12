import type { QuizDocument } from './quiz-document.types';

/** A quiz of the "Варіанти" mode, as edited, exported and imported. Mirrors `get_quiz` / `save_quiz`. */
export interface BluffFact {
  /** The fact with its ending left out: "У Швеції є готель, збудований з…". */
  text: string;
  /** The missing ending. */
  truth: string;
  /** The host's own lie among the options. */
  decoy: string;
  /** Optional: told once the truth is revealed. */
  explanation: string;
  /** Other decoys the AI offered, to swap in. Kept in the editor only, never saved. */
  decoyIdeas?: string[];
}

export interface BluffDocument {
  title: string;
  mode: 'bluff';
  facts: BluffFact[];
}

/** Either kind of quiz, as `get_quiz` returns it. */
export type AnyQuizDocument = QuizDocument | BluffDocument;
