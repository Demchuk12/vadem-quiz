import type { GeneratedRound, QuizCategory, QuizDocument, QuizQuestion } from './quiz-document';

/** What an AI edit changes: a whole round, one category of it, or one question. */
export interface EditTarget {
  round: number;
  category?: number;
  question?: number;
}

/** The text the AI sees and rewrites, in the shape it replies with. */
export interface EditSource {
  title: string;
  questions: { text: string; answer: string; explanation: string }[];
}

function categoriesOf(doc: QuizDocument, target: EditTarget): QuizCategory[] {
  const categories = doc.rounds[target.round]?.categories ?? [];
  if (target.category === undefined) return categories;
  const category = categories[target.category];
  if (!category) return [];
  if (target.question === undefined) return [category];
  const question = category.questions[target.question];
  return question ? [{ ...category, questions: [question] }] : [];
}

/**
 * The content to send, or null when the AI cannot edit it as one block: the reply has one count
 * of questions per category, so a round whose categories differ in size is edited by category.
 */
export function editSource(doc: QuizDocument, target: EditTarget): EditSource[] | null {
  const categories = categoriesOf(doc, target);
  const sizes = new Set(categories.map((category) => category.questions.length));
  if (categories.length === 0 || sizes.size !== 1 || sizes.has(0)) return null;
  return categories.map((category) => ({
    title: category.title,
    questions: category.questions.map(({ text, answerText, explanation }) => ({
      text,
      answer: answerText,
      explanation,
    })),
  }));
}

/** Category titles outside the target, which an edit must not repeat. */
export function titlesOutside(doc: QuizDocument, target: EditTarget): string[] {
  return doc.rounds.flatMap((round, r) =>
    round.categories
      .filter(
        (_, c) => r !== target.round || (target.category !== undefined && c !== target.category),
      )
      .map((category) => category.title.trim())
      .filter(Boolean),
  );
}

/** Answers outside the target, which an edit must not ask about again. */
export function answersOutside(doc: QuizDocument, target: EditTarget): string[] {
  return doc.rounds.flatMap((round, r) =>
    round.categories.flatMap((category, c) =>
      category.questions
        .filter(
          (_, q) =>
            r !== target.round ||
            (target.category !== undefined &&
              (c !== target.category || (target.question !== undefined && q !== target.question))),
        )
        .map((question) => question.answerText.trim())
        .filter(Boolean),
    ),
  );
}

const sameAnswer = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function replaceTarget(
  doc: QuizDocument,
  target: EditTarget,
  change: (category: QuizCategory, index: number) => QuizCategory,
): QuizDocument {
  let next = 0;
  return {
    ...doc,
    rounds: doc.rounds.map((round, r) =>
      r !== target.round
        ? round
        : {
            categories: round.categories.map((category, c) =>
              target.category === undefined || c === target.category
                ? change(category, next++)
                : category,
            ),
          },
    ),
  };
}

/**
 * Puts an edit into the quiz. Point values stay. Pictures stay while the answer does, since then
 * the question is still about the same thing; a new photo from the AI goes with the answer.
 */
export function applyEdit(
  doc: QuizDocument,
  target: EditTarget,
  edited: GeneratedRound,
): QuizDocument {
  return replaceTarget(doc, target, (category, index) => {
    const written = edited.categories[index];
    if (!written) return category;
    const rewrite = (old: QuizQuestion, q: number): QuizQuestion => {
      const fresh = written.questions[q];
      if (!fresh) return old;
      const keeps = sameAnswer(old.answerText, fresh.answer);
      return {
        basePoints: old.basePoints,
        text: fresh.text,
        imagePath: keeps ? old.imagePath : null,
        answerText: fresh.answer,
        answerImagePath: fresh.answerImagePath ?? (keeps ? old.answerImagePath : null),
        explanation: fresh.explanation ?? old.explanation,
      };
    };
    if (target.question !== undefined) {
      return {
        ...category,
        questions: category.questions.map((old, q) =>
          q === target.question ? rewrite(old, 0) : old,
        ),
      };
    }
    return { title: written.title, questions: category.questions.map(rewrite) };
  });
}

/** Undoes an edit: the target gets back what it held in `before`, the rest stays as it is now. */
export function restoreEdit(
  doc: QuizDocument,
  target: EditTarget,
  before: QuizDocument,
): QuizDocument {
  const old = before.rounds[target.round]?.categories ?? [];
  return replaceTarget(doc, target, (category, index) => {
    const previous = target.category === undefined ? old[index] : old[target.category];
    if (!previous) return category;
    if (target.question === undefined) return previous;
    return {
      ...category,
      questions: category.questions.map((question, q) =>
        q === target.question ? (previous.questions[q] ?? question) : question,
      ),
    };
  });
}
