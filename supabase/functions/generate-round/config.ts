// Limits and fixed values of the function.

import type { Vendor } from './types.ts';

/** Stays under the platform's request limit, however many attempts it takes. */
export const TIME_BUDGET_MS = 130_000;

/** Free models can be slow: one attempt may take most of the budget. */
export const ATTEMPT_TIMEOUT_MS = 90_000;

export const MIN_ATTEMPT_MS = 15_000;

export const RETRY_DELAY_MS = 2_000;

export const MAX_PROMPT_LENGTH = 1500;

export const MAX_CATEGORIES = 8;

export const MAX_QUESTIONS = 8;

export const MAX_AVOID = 40;

export const MAX_TEXT = 2000;

export const MAX_AVOID_ANSWERS = 150;

export const MAX_ANSWER_HINT = 80;

export const SITE_URL = 'https://vadem-quiz.vercel.app';

export const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

/** Wikimedia serves thumbnails from more than one host, all with open CORS. */
export const IMAGE_HOST = /^https:\/\/[a-z]+\.wikimedia\.org\//;

export const IMAGE_SIZE = 1024;

export const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const VENDORS: Vendor[] = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'openrouter'];

export const MAX_OWN = 4;

export const VENDOR_LABELS: Record<Vendor, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
};

export const REPLACE_FLAWED =
  'Заміни ці питання новими на ту саму тему і тієї ж складності. Кожне нове питання має ' +
  'відповідь, якої ще немає серед використаних, і текст питання не містить відповіді в ' +
  'жодній формі: ні прямо, ні перекладом чи транслітерацією, ні спорідненим словом.';

/** For the host's own edit, whose answers stay: only the giveaway wording changes. */
export const REWORD_LEAKS =
  'Перепиши ці питання так, щоб текст питання не містив відповіді в жодній формі: ні прямо, ' +
  'ні перекладом чи транслітерацією, ні спорідненим словом. Відповідь, складність і тему лиши ' +
  'тими самими.';

/** Passes at replacing flawed questions before the round counts as unusable. */
export const REPLACE_PASSES = 3;

/** How long to wait when a provider's per-minute limit stops a replacement. */
export const BUSY_WAIT_MS = 15_000;
