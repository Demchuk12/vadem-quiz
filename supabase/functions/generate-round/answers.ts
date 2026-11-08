// Reads an AI's reply into a round of the right shape.

import { Retryable } from './errors.ts';
import { isOwn } from './http.ts';
import type { GeneratedQuestion, GeneratedRound, RoundRequest } from './types.ts';

export const isQuestion = (question: GeneratedQuestion | undefined) =>
  typeof question?.text === 'string' &&
  question.text.trim() !== '' &&
  typeof question?.answer === 'string' &&
  question.answer.trim() !== '' &&
  (question.explanation === undefined || typeof question.explanation === 'string') &&
  (question.image === undefined || typeof question.image === 'string');

/**
 * Schemas shape the answer but do not fix the counts, and a short round would break the board.
 * Extra categories or questions are dropped: models often write one too many.
 */
export function checkRound(value: unknown, request: RoundRequest): GeneratedRound {
  const written = (value as GeneratedRound | null)?.categories;
  const categories = (Array.isArray(written) ? written : [])
    .filter(
      (category) =>
        typeof category?.title === 'string' &&
        category.title.trim() !== '' &&
        Array.isArray(category.questions),
    )
    .map((category) => ({
      title: category.title,
      questions: category.questions.filter(isQuestion).slice(0, request.questions),
    }))
    .filter((category) => category.questions.length === request.questions)
    .slice(0, request.categories);
  if (categories.length < request.categories) {
    const counts = (Array.isArray(written) ? written : []).map((c) =>
      Array.isArray(c?.questions) ? c.questions.length : 0,
    );
    throw new Error(`Wanted ${request.categories}x${request.questions}, got [${counts.join(',')}]`);
  }
  return { categories };
}

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[«»"'’.,!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function parseAnswer(text: unknown, request: RoundRequest, name: string): GeneratedRound {
  try {
    // Some models wrap JSON in a code fence despite the instructions.
    const json = String(text).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '');
    return checkRound(JSON.parse(json), request);
  } catch (error) {
    console.error(
      name,
      'gave an unusable answer',
      String(error),
      isOwn(name) ? '' : String(text).slice(0, 200),
    );
    throw new Retryable('ai_failed');
  }
}
