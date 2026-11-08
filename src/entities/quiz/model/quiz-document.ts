import {
  DEFAULT_BASE_POINTS,
  DEFAULT_CATEGORIES_PER_ROUND,
  DEFAULT_MULTIPLIERS,
} from '../config/quiz-defaults';
import type {
  GeneratedRound,
  QuizCategory,
  QuizDocument,
  QuizProgress,
  QuizQuestion,
} from './quiz-document.types';

const emptyQuestion = (basePoints: number): QuizQuestion => ({
  basePoints,
  text: '',
  imagePath: null,
  answerText: '',
  answerImagePath: null,
  explanation: '',
});

const emptyCategory = (): QuizCategory => ({
  title: '',
  questions: DEFAULT_BASE_POINTS.map(emptyQuestion),
});

export function emptyQuiz(title: string): QuizDocument {
  return {
    title,
    roundMultipliers: [...DEFAULT_MULTIPLIERS],
    rounds: DEFAULT_MULTIPLIERS.map(() => ({
      categories: Array.from({ length: DEFAULT_CATEGORIES_PER_ROUND }, emptyCategory),
    })),
  };
}

export const pointsOf = (basePoints: number, round: number, doc: QuizDocument): number =>
  basePoints * (doc.roundMultipliers[round] ?? 1);

export function isQuestionComplete(question: QuizQuestion): boolean {
  const hasQuestion = question.text.trim() !== '' || question.imagePath !== null;
  const hasAnswer = question.answerText.trim() !== '' || question.answerImagePath !== null;
  return hasQuestion && hasAnswer;
}

export function quizProgress(doc: QuizDocument): QuizProgress {
  const categories = doc.rounds.flatMap((round) => round.categories);
  const questions = categories.flatMap((category) => category.questions);
  return {
    complete: questions.filter(isQuestionComplete).length,
    total: questions.length,
    missingTitles: categories.filter((category) => category.title.trim() === '').length,
  };
}

/** Immutable edit of one question. */
export function updateQuestion(
  doc: QuizDocument,
  at: { round: number; category: number; question: number },
  patch: Partial<QuizQuestion>,
): QuizDocument {
  return updateCategory(doc, at.round, at.category, (category) => ({
    ...category,
    questions: category.questions.map((question, index) =>
      index === at.question ? { ...question, ...patch } : question,
    ),
  }));
}

function updateRound(
  doc: QuizDocument,
  round: number,
  change: (categories: QuizCategory[]) => QuizCategory[],
): QuizDocument {
  return {
    ...doc,
    rounds: doc.rounds.map((r, i) => (i === round ? { categories: change(r.categories) } : r)),
  };
}

export function updateCategory(
  doc: QuizDocument,
  round: number,
  category: number,
  change: (category: QuizCategory) => QuizCategory,
): QuizDocument {
  return updateRound(doc, round, (categories) =>
    categories.map((c, i) => (i === category ? change(c) : c)),
  );
}

export function addCategory(doc: QuizDocument, round: number): QuizDocument {
  return updateRound(doc, round, (categories) => [...categories, emptyCategory()]);
}

export function removeCategory(doc: QuizDocument, round: number, category: number): QuizDocument {
  return updateRound(doc, round, (categories) => categories.filter((_, i) => i !== category));
}

/** What the AI has to write so that a round keeps the shape the host set up. */
export function roundShape(
  doc: QuizDocument,
  round: number,
): { categories: number; questions: number } {
  const categories = doc.rounds[round]?.categories ?? [];
  return {
    categories: categories.length || DEFAULT_CATEGORIES_PER_ROUND,
    questions:
      Math.max(0, ...categories.map((c) => c.questions.length)) || DEFAULT_BASE_POINTS.length,
  };
}

/** Puts a generated round into the quiz. It keeps the point values and replaces the pictures. */
export function applyGeneratedRound(
  doc: QuizDocument,
  round: number,
  generated: GeneratedRound,
): QuizDocument {
  return updateRound(doc, round, (categories) =>
    generated.categories.map((category, c) => ({
      title: category.title,
      questions: category.questions.map((question, q) => ({
        basePoints:
          categories[c]?.questions[q]?.basePoints ??
          DEFAULT_BASE_POINTS[q] ??
          DEFAULT_BASE_POINTS[DEFAULT_BASE_POINTS.length - 1]!,
        text: question.text,
        imagePath: null,
        answerText: question.answer,
        answerImagePath: question.answerImagePath ?? null,
        explanation: question.explanation ?? '',
      })),
    })),
  );
}

export class QuizImportError extends Error {}

function asString(value: unknown, where: string): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  throw new QuizImportError(`${where}: очікується текст`);
}

function asImagePath(value: unknown, where: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return asString(value, where);
}

function asPositiveInt(value: unknown, where: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new QuizImportError(`${where}: очікується додатне ціле число`);
}

function asArray(value: unknown, where: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new QuizImportError(`${where}: очікується список`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new QuizImportError(`${where}: очікується об'єкт`);
}

/**
 * Validates an imported file. Image paths from another quiz are dropped, because files belong to
 * the quiz they were uploaded to; the count lets the page say so.
 */
export function parseQuizDocument(
  json: string,
  quizId: string,
): { document: QuizDocument; droppedImages: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new QuizImportError('Файл не є коректним JSON');
  }

  let droppedImages = 0;
  const ownImage = (value: unknown, where: string): string | null => {
    const path = asImagePath(value, where);
    if (path !== null && !path.startsWith(`${quizId}/`)) {
      droppedImages += 1;
      return null;
    }
    return path;
  };

  const root = asRecord(raw, 'Квіз');
  const rounds = asArray(root['rounds'], 'rounds');
  const roundMultipliers = asArray(root['roundMultipliers'], 'roundMultipliers').map((m, i) =>
    asPositiveInt(m, `roundMultipliers[${i}]`),
  );
  if (rounds.length === 0 || rounds.length !== roundMultipliers.length) {
    throw new QuizImportError('Кількість раундів не збігається з кількістю множників');
  }

  const document: QuizDocument = {
    title: asString(root['title'], 'title'),
    roundMultipliers,
    rounds: rounds.map((r, ri) => ({
      categories: asArray(asRecord(r, `Раунд ${ri + 1}`)['categories'], `Раунд ${ri + 1}`).map(
        (c, ci) => {
          const where = `Раунд ${ri + 1}, категорія ${ci + 1}`;
          const category = asRecord(c, where);
          return {
            title: asString(category['title'], where),
            questions: asArray(category['questions'], where).map((q, qi) => {
              const at = `${where}, питання ${qi + 1}`;
              const question = asRecord(q, at);
              return {
                basePoints: asPositiveInt(question['basePoints'], at),
                text: asString(question['text'], at),
                imagePath: ownImage(question['imagePath'], at),
                answerText: asString(question['answerText'], at),
                answerImagePath: ownImage(question['answerImagePath'], at),
                explanation: asString(question['explanation'], at),
              };
            }),
          };
        },
      ),
    })),
  };
  return { document, droppedImages };
}
