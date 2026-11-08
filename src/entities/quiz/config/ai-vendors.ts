import type { AiVendor } from '../api/quiz-api.types';

/** How each AI company is named to the host. */
export const VENDOR_LABELS: Record<AiVendor, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
};
