import { BLUFF_FACTS } from '../config/bluff-limits';
import type { AnyQuizDocument, BluffDocument, BluffFact } from './bluff-document.types';
import type { QuizProgress } from './quiz-document.types';

const emptyFact = (): BluffFact => ({ text: '', truth: '', decoy: '', explanation: '' });

export function emptyBluffQuiz(title: string): BluffDocument {
  return { title, mode: 'bluff', facts: Array.from({ length: BLUFF_FACTS.default }, emptyFact) };
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
