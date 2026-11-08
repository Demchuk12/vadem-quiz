// Questions that repeat an answer or give it away, and their replacement.

import { normalize } from './answers.ts';
import {
  ATTEMPT_TIMEOUT_MS,
  BUSY_WAIT_MS,
  MAX_AVOID_ANSWERS,
  MIN_ATTEMPT_MS,
  REPLACE_FLAWED,
  REPLACE_PASSES,
  REWORD_LEAKS,
} from './config.ts';
import { Retryable } from './errors.ts';
import { leaksAnswer } from './leaks.ts';
import type { Attempt, GeneratedRound, Place, RoundRequest } from './types.ts';

/**
 * Questions that give their answer away, or, in a new round, repeat an answer the quiz already
 * has. An edit by the host keeps its answers: they asked for that change, not another.
 */
export function flawed(round: GeneratedRound, request: RoundRequest): Place[] {
  const writing = request.current === null;
  const seen = new Set(request.avoidAnswers.map(normalize));
  const places: Place[] = [];
  round.categories.forEach((category, c) =>
    category.questions.forEach((question, q) => {
      const answer = normalize(question.answer);
      const repeats = writing && seen.has(answer);
      if (repeats || leaksAnswer(question.text, question.answer)) places.push({ c, q });
      else seen.add(answer);
    }),
  );
  return places;
}

/**
 * Models repeat answers on a narrow topic and write answers into questions. Rather than throw the
 * whole round away, the flawed questions alone go back to the same AI to be replaced, on the
 * same topic and level, with answers the quiz does not have yet.
 */
export async function withoutFlaws(
  round: GeneratedRound,
  request: RoundRequest,
  attempt: Attempt,
  deadline: number,
): Promise<GeneratedRound> {
  let current = round;
  for (let pass = 0; pass < REPLACE_PASSES; pass += 1) {
    const places = flawed(current, request);
    if (places.length === 0) return current;
    console.error(attempt.label, 'replaces', places.length, 'flawed questions');
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;

    const bad = new Set(places.map(({ c, q }) => `${c}:${q}`));
    const kept = current.categories.flatMap((category, c) =>
      category.questions.filter((_, q) => !bad.has(`${c}:${q}`)).map((question) => question.answer),
    );
    const replacement = {
      ...request,
      prompt: request.current === null ? REPLACE_FLAWED : REWORD_LEAKS,
      categories: 1,
      questions: places.length,
      avoid: [],
      avoidAnswers: [...request.avoidAnswers, ...kept].slice(-MAX_AVOID_ANSWERS),
      images: false,
      current: [
        {
          title: current.categories[places[0]!.c]!.title,
          questions: places.map(({ c, q }) => {
            const question = current.categories[c]!.questions[q]!;
            return {
              text: question.text,
              answer: question.answer,
              explanation: question.explanation ?? '',
            };
          }),
        },
      ],
    };
    let fixed: GeneratedRound;
    try {
      fixed = await attempt.run(replacement, Math.min(remaining, ATTEMPT_TIMEOUT_MS));
    } catch (error) {
      // A per-minute limit, hit by the round just written: wait it out once, if time allows.
      if (!(error instanceof Retryable) || error.code !== 'ai_busy') throw error;
      if (deadline - Date.now() < BUSY_WAIT_MS + MIN_ATTEMPT_MS) throw error;
      await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS));
      continue;
    }
    const replacements = fixed.categories[0]!.questions;
    const categories = current.categories.map((category) => ({
      ...category,
      questions: [...category.questions],
    }));
    places.forEach(({ c, q }, index) => {
      const old = categories[c]!.questions[q]!;
      const fresh = replacements[index]!;
      // A photo belongs to its answer: it goes when the answer changes.
      const sameAnswer = normalize(fresh.answer) === normalize(old.answer);
      categories[c]!.questions[q] = {
        text: fresh.text,
        answer: fresh.answer,
        explanation: fresh.explanation || (sameAnswer ? old.explanation : ''),
        image: sameAnswer ? old.image : '',
      };
    });
    current = { categories };
  }
  if (flawed(current, request).length > 0) throw new Retryable('ai_failed');
  return current;
}
