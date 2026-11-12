/** The quiz as edited, exported and imported. Mirrors `get_quiz` / `save_quiz`. */
export interface QuizQuestion {
  basePoints: number;
  text: string;
  imagePath: string | null;
  answerText: string;
  answerImagePath: string | null;
  /** Optional: why the answer is right. Revealed together with it. */
  explanation: string;
}

export interface QuizCategory {
  title: string;
  questions: QuizQuestion[];
}

export interface QuizRound {
  categories: QuizCategory[];
}

export interface QuizDocument {
  title: string;
  roundMultipliers: number[];
  rounds: QuizRound[];
}

export interface QuizProgress {
  complete: number;
  total: number;
  missingTitles: number;
}

/** One round as the AI writes it: text only, the values come from the quiz. */
export interface GeneratedQuestion {
  text: string;
  answer: string;
  explanation?: string;
  /** "Варіанти" only: false endings for the host's decoy. */
  decoys?: string[];
  /** A photo of the answer, already stored with the quiz: it shows once the answer is revealed. */
  answerImagePath?: string | null;
}

export interface GeneratedRound {
  categories: { title: string; questions: GeneratedQuestion[] }[];
}
