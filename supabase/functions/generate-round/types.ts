// The shapes of requests, rounds and providers.

export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export type Choice = ProviderId | 'auto' | 'own';

export type Vendor = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'mistral' | 'openrouter';

/** One of the host's own AIs: their key and the model they picked. */
export interface OwnAi {
  vendor: Vendor;
  key: string;
  model: string;
}

export interface RoundRequest {
  quizId: string;
  token: string;
  prompt: string;
  round: number;
  roundCount: number;
  categories: number;
  questions: number;
  avoid: string[];
  /** Answers already in the quiz: no question may lead to them again. */
  avoidAnswers: string[];
  provider: Choice;
  images: boolean;
  /** Ask for an explanation of every answer. */
  explain: boolean;
  own: OwnAi[];
  /** Content to edit, shaped like the reply: `categories` items of `questions` questions. */
  current: CurrentCategory[] | null;
}

export interface CurrentCategory {
  title: string;
  questions: { text: string; answer: string; explanation: string }[];
}

export interface GeneratedQuestion {
  text: string;
  answer: string;
  explanation?: string;
  /** From the AI: a Wikipedia article title, or empty. Replaced by `imageUrl` before replying. */
  image?: string;
  imageUrl?: string;
}

export interface GeneratedRound {
  categories: { title: string; questions: GeneratedQuestion[] }[];
}

export interface Attempt {
  label: string;
  run(request: RoundRequest, timeoutMs: number): Promise<GeneratedRound>;
}

export interface Provider {
  /** A free provider, or "own:N" for the host's Nth own AI. */
  id: string;
  label: string;
  attempts(): Attempt[];
}

export interface Place {
  c: number;
  q: number;
}
