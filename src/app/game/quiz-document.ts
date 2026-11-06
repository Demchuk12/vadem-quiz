/** The quiz as edited, exported and imported. Mirrors `get_quiz` / `save_quiz`. */
export interface QuizQuestion {
  basePoints: number;
  text: string;
  imagePath: string | null;
  answerText: string;
  answerImagePath: string | null;
}

export interface QuizCategory {
  title: string;
  questions: QuizQuestion[];
}

export interface QuizRound {
  categories: QuizCategory[];
}

export interface QuizDocument {
  title: string;
  roundMultipliers: number[];
  rounds: QuizRound[];
}

export const DEFAULT_BASE_POINTS: readonly number[] = [200, 400, 600, 800, 1000];
const DEFAULT_MULTIPLIERS: readonly number[] = [1, 2, 3];
const DEFAULT_CATEGORIES_PER_ROUND = 5;

const emptyQuestion = (basePoints: number): QuizQuestion => ({
  basePoints,
  text: '',
  imagePath: null,
  answerText: '',
  answerImagePath: null,
});

export const emptyCategory = (): QuizCategory => ({
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

export interface QuizProgress {
  complete: number;
  total: number;
  missingTitles: number;
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

/** Same rules as `create_room`, so the host learns about a gap before starting a game. */
export function isQuizPlayable({ rounds, ...rest }: QuizDocument): boolean {
  const progress = quizProgress({ rounds, ...rest });
  return (
    rounds.every((round) => round.categories.length > 0) &&
    rounds.every((round) => round.categories.every((category) => category.questions.length > 0)) &&
    progress.total > 0 &&
    progress.complete === progress.total &&
    progress.missingTitles === 0
  );
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

export function updateCategory(
  doc: QuizDocument,
  round: number,
  category: number,
  change: (category: QuizCategory) => QuizCategory,
): QuizDocument {
  return {
    ...doc,
    rounds: doc.rounds.map((r, roundIndex) =>
      roundIndex === round
        ? { categories: r.categories.map((c, i) => (i === category ? change(c) : c)) }
        : r,
    ),
  };
}

export function addCategory(doc: QuizDocument, round: number): QuizDocument {
  return {
    ...doc,
    rounds: doc.rounds.map((r, i) =>
      i === round ? { categories: [...r.categories, emptyCategory()] } : r,
    ),
  };
}

export function removeCategory(doc: QuizDocument, round: number, category: number): QuizDocument {
  return {
    ...doc,
    rounds: doc.rounds.map((r, i) =>
      i === round ? { categories: r.categories.filter((_, c) => c !== category) } : r,
    ),
  };
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
              };
            }),
          };
        },
      ),
    })),
  };
  return { document, droppedImages };
}
