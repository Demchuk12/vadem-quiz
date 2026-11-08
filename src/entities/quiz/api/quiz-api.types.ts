import type { EditSource } from '../model/ai-edit';

export interface NewQuiz {
  quiz_id: string;
  owner_token: string;
}

/** An AI that can write rounds: this deployment has its key. */
export interface AiProvider {
  id: string;
  label: string;
}

/** Companies whose AI a host can connect with their own key. */
export type AiVendor = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'mistral' | 'openrouter';

/** A host's own AI as the function needs it for one request. */
export interface OwnAiCredentials {
  vendor: AiVendor;
  key: string;
  model: string;
}

export interface AiModel {
  id: string;
  label: string;
}

export interface GenerateRoundRequest {
  quizId: string;
  token: string;
  prompt: string;
  /** Counted from 1. */
  round: number;
  roundCount: number;
  categories: number;
  questions: number;
  /** Category titles already used by earlier rounds. */
  avoid: string[];
  /** Answers already in the quiz, which the AI must not ask about again. */
  avoidAnswers: string[];
  /** A free provider's id, "own" for the one AI in `own`, or "auto" for the first that answers. */
  provider: string;
  /** The host's own AIs: the one chosen, or all of them for "auto", which tries them first. */
  own?: OwnAiCredentials[];
  /** Ask for an explanation of every answer. */
  explain?: boolean;
  /** Ask for some questions with a photo from Wikipedia. */
  images: boolean;
  /** Content to edit by the instruction in `prompt`, instead of writing from a topic. */
  current?: EditSource[];
}

/** As the AI wrote it. A question's `imageUrl` is a photo still to be stored with the quiz. */
export interface GeneratedRoundResult {
  provider: string;
  categories: {
    title: string;
    questions: { text: string; answer: string; explanation?: string; imageUrl?: string }[];
  }[];
}
