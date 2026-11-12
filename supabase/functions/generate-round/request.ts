// Reads and checks a request to write or edit a round.

import {
  MAX_ANSWER_HINT,
  MAX_AVOID,
  MAX_AVOID_ANSWERS,
  MAX_CATEGORIES,
  MAX_FACTS,
  MAX_OWN,
  MAX_PROMPT_LENGTH,
  MAX_QUESTIONS,
  MAX_TEXT,
  VENDORS,
} from './config.ts';
import { Failure } from './errors.ts';
import type { Choice, CurrentCategory, Mode, OwnAi, RoundRequest, Vendor } from './types.ts';

export const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TEXT;

export const isKey = (value: unknown): value is string =>
  typeof value === 'string' && /^[\x21-\x7e]{8,400}$/.test(value);

export const isVendor = (value: unknown): value is Vendor => VENDORS.includes(value as Vendor);

export function parseOwn(value: unknown): OwnAi[] {
  if (value === undefined || value === null) return [];
  const valid =
    Array.isArray(value) &&
    value.length <= MAX_OWN &&
    value.every(
      (own) =>
        isVendor(own?.vendor) &&
        isKey(own?.key) &&
        typeof own?.model === 'string' &&
        /^[\w.:/@-]{1,120}$/.test(own.model),
    );
  if (!valid) throw new Failure(400, 'invalid_prompt');
  return (value as OwnAi[]).map(({ vendor, key, model }) => ({ vendor, key, model }));
}

/** The content to edit must match the shape the reply will have. */
export function parseCurrent(value: unknown, categories: number, questions: number) {
  if (value === undefined || value === null) return null;
  const valid =
    Array.isArray(value) &&
    value.length === categories &&
    value.every(
      (category) =>
        isText(category?.title) &&
        Array.isArray(category?.questions) &&
        category.questions.length === questions &&
        category.questions.every(
          (q: Record<string, unknown>) =>
            isText(q?.['text']) && isText(q?.['answer']) && isText(q?.['explanation']),
        ),
    );
  if (!valid) throw new Failure(400, 'invalid_prompt');
  return (value as CurrentCategory[]).map((category) => ({
    title: category.title,
    questions: category.questions.map(({ text, answer, explanation }) => ({
      text,
      answer,
      explanation,
    })),
  }));
}

export function parseRequest(body: unknown): RoundRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const prompt = typeof b['prompt'] === 'string' ? b['prompt'].trim() : '';
  const avoid = Array.isArray(b['avoid']) ? b['avoid'] : [];
  const avoidAnswers = Array.isArray(b['avoidAnswers']) ? b['avoidAnswers'] : [];
  const provider = b['provider'] ?? 'auto';
  const mode: Mode = b['mode'] === 'bluff' ? 'bluff' : 'board';
  // Facts come as one list: a single "category" of up to twenty.
  const shapeOk =
    mode === 'bluff'
      ? b['categories'] === 1 && isCount(b['questions'], MAX_FACTS)
      : isCount(b['categories'], MAX_CATEGORIES) && isCount(b['questions'], MAX_QUESTIONS);
  if (
    !shapeOk ||
    typeof b['quizId'] !== 'string' ||
    typeof b['token'] !== 'string' ||
    prompt.length < 3 ||
    prompt.length > MAX_PROMPT_LENGTH ||
    !isCount(b['round'], 5) ||
    !isCount(b['roundCount'], 5) ||
    avoid.length > MAX_AVOID ||
    !avoid.every((item) => typeof item === 'string') ||
    avoidAnswers.length > MAX_AVOID_ANSWERS ||
    !avoidAnswers.every((item) => typeof item === 'string') ||
    !['auto', 'gemini', 'groq', 'openrouter', 'own'].includes(provider as string) ||
    (b['images'] !== undefined && typeof b['images'] !== 'boolean') ||
    (b['explain'] !== undefined && typeof b['explain'] !== 'boolean')
  ) {
    throw new Failure(400, 'invalid_prompt');
  }
  const own = parseOwn(b['own']);
  if (provider === 'own' && own.length !== 1) throw new Failure(400, 'invalid_prompt');
  return {
    mode,
    quizId: b['quizId'],
    token: b['token'],
    prompt,
    round: b['round'],
    roundCount: b['roundCount'],
    categories: b['categories'] as number,
    questions: b['questions'] as number,
    avoid: avoid as string[],
    avoidAnswers: (avoidAnswers as string[])
      .map((answer) => answer.trim().slice(0, MAX_ANSWER_HINT))
      .filter(Boolean),
    provider: provider as Choice,
    images: mode === 'board' && b['images'] === true,
    explain: b['explain'] === true,
    own: provider === 'auto' || provider === 'own' ? own : [],
    current: parseCurrent(b['current'], b['categories'] as number, b['questions'] as number),
  };
}
