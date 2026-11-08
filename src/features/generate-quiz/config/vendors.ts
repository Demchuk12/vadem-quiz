import type { AiVendor } from '@entities/quiz';

export interface Vendor {
  id: AiVendor;
  label: string;
  /** Where the host makes a key. */
  keysUrl: string;
}

export const VENDORS: Vendor[] = [
  {
    id: 'gemini',
    label: 'Gemini (Google), безкоштовно',
    keysUrl: 'https://aistudio.google.com/apikey',
  },
  { id: 'groq', label: 'Groq, безкоштовно', keysUrl: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'ChatGPT (OpenAI)', keysUrl: 'https://platform.openai.com/api-keys' },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  { id: 'mistral', label: 'Mistral', keysUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'openrouter', label: 'OpenRouter', keysUrl: 'https://openrouter.ai/keys' },
];
