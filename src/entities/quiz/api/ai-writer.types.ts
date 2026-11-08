import type { GenerateRoundRequest, OwnAiCredentials } from './quiz-api.types';
import type { GeneratedRound } from '../model/quiz-document.types';

export type AiRequest = Omit<GenerateRoundRequest, 'provider' | 'own'>;

export interface AiResult {
  round: GeneratedRound;
  /** The name of the AI that wrote it, as the host knows it. */
  writer: string;
}

/** A host's own AI, kept in this browser only. */
export interface OwnAi extends OwnAiCredentials {
  id: string;
  modelLabel: string;
}

/** One line of the "who writes" choice. */
export interface AiOption {
  id: string;
  label: string;
  /** Which mark to show: a vendor, a free provider, or "auto". */
  icon: string;
}
