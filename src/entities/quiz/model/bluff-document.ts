import { BLUFF_FACTS, BLUFF_SECONDS } from '../config/bluff-limits';
import type { AnyQuizDocument, BluffDocument, BluffFact } from './bluff-document.types';
import type { GeneratedRound, QuizProgress } from './quiz-document.types';

const emptyFact = (): BluffFact => ({ text: '', truth: '', decoy: '', explanation: '' });

export function emptyBluffQuiz(title: string): BluffDocument {
  return {
    title,
    mode: 'bluff',
    facts: Array.from({ length: BLUFF_FACTS.default }, emptyFact),
    writingSeconds: BLUFF_SECONDS.writing,
    votingSeconds: BLUFF_SECONDS.voting,
  };
}

export const isBluff = (doc: AnyQuizDocument): doc is BluffDocument =>
  'mode' in doc && doc.mode === 'bluff';

export const isFactComplete = (fact: BluffFact): boolean =>
  fact.text.trim() !== '' && fact.truth.trim() !== '' && fact.decoy.trim() !== '';

export function bluffProgress(doc: BluffDocument): QuizProgress {
  return {
    complete: doc.facts.filter(isFactComplete).length,
    total: doc.facts.length,
    missingTitles: 0,
  };
}

export function updateFact(
  doc: BluffDocument,
  index: number,
  patch: Partial<BluffFact>,
): BluffDocument {
  return {
    ...doc,
    facts: doc.facts.map((fact, i) => (i === index ? { ...fact, ...patch } : fact)),
  };
}

export function addFact(doc: BluffDocument): BluffDocument {
  if (doc.facts.length >= BLUFF_FACTS.max) return doc;
  return { ...doc, facts: [...doc.facts, emptyFact()] };
}

export function removeFact(doc: BluffDocument, index: number): BluffDocument {
  return { ...doc, facts: doc.facts.filter((_, i) => i !== index) };
}

/** The AI's facts replace the quiz's: the first decoy goes in, the others wait as ideas. */
export function applyGeneratedFacts(doc: BluffDocument, round: GeneratedRound): BluffDocument {
  const facts = round.categories[0]?.questions ?? [];
  return {
    ...doc,
    facts: facts.map((fact) => ({
      text: fact.text,
      truth: fact.answer,
      decoy: fact.decoys?.[0] ?? '',
      decoyIdeas: fact.decoys?.slice(1) ?? [],
      explanation: fact.explanation ?? '',
    })),
  };
}

/** Puts an offered decoy in, and the one it replaces back among the ideas. */
export function swapDecoy(doc: BluffDocument, index: number, idea: string): BluffDocument {
  const fact = doc.facts[index];
  if (!fact) return doc;
  const others = (fact.decoyIdeas ?? []).filter((other) => other !== idea);
  return updateFact(doc, index, {
    decoy: idea,
    decoyIdeas: fact.decoy.trim() ? [fact.decoy, ...others] : others,
  });
}
