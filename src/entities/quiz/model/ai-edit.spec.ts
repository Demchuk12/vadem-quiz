import { applyEdit, editSource, restoreEdit, titlesOutside } from './ai-edit';
import { emptyQuiz, updateCategory, updateQuestion, type QuizDocument } from './quiz-document';

function quiz(): QuizDocument {
  let doc = emptyQuiz('T');
  doc = updateCategory(doc, 0, 0, (c) => ({ ...c, title: 'Кіно' }));
  doc = updateCategory(doc, 0, 1, (c) => ({ ...c, title: 'Музика' }));
  doc = updateCategory(doc, 1, 0, (c) => ({ ...c, title: 'Спорт' }));
  return updateQuestion(
    doc,
    { round: 0, category: 0, question: 1 },
    {
      text: 'Хто зняв «Титанік»?',
      answerText: 'Джеймс Кемерон',
      imagePath: 'q/old.webp',
      answerImagePath: 'q/answer.webp',
      explanation: 'Фільм 1997 року.',
    },
  );
}

const one = (text: string, answer: string, extra: object = {}) => ({
  categories: [{ title: 'Нове', questions: [{ text, answer, ...extra }] }],
});

describe('editSource', () => {
  it('sends one question with its category, or a whole category', () => {
    const doc = quiz();
    expect(editSource(doc, { round: 0, category: 0, question: 1 })).toEqual([
      {
        title: 'Кіно',
        questions: [
          {
            text: 'Хто зняв «Титанік»?',
            answer: 'Джеймс Кемерон',
            explanation: 'Фільм 1997 року.',
          },
        ],
      },
    ]);
    expect(editSource(doc, { round: 0, category: 1 })![0]!.questions).toHaveLength(5);
    expect(editSource(doc, { round: 0 })).toHaveLength(5);
  });

  it('refuses a round whose categories differ in size, and an empty target', () => {
    const doc = updateCategory(quiz(), 0, 2, (c) => ({ ...c, questions: c.questions.slice(1) }));
    expect(editSource(doc, { round: 0 })).toBeNull();
    expect(editSource(doc, { round: 0, category: 2 })).not.toBeNull();
    expect(editSource(doc, { round: 0, category: 9 })).toBeNull();
  });
});

describe('titlesOutside', () => {
  it('lists the titles an edit must not repeat', () => {
    const doc = quiz();
    expect(titlesOutside(doc, { round: 0 })).toEqual(['Спорт']);
    expect(titlesOutside(doc, { round: 0, category: 0 })).toEqual(['Музика', 'Спорт']);
  });
});

describe('applyEdit', () => {
  const at = { round: 0, category: 0, question: 1 };

  it('changes only the target question and keeps its points and category title', () => {
    const doc = quiz();
    const next = applyEdit(doc, at, one('Новий текст', 'Джеймс Кемерон'));
    const category = next.rounds[0]!.categories[0]!;
    expect(category.title).toBe('Кіно');
    expect(category.questions[1]).toMatchObject({
      basePoints: 400,
      text: 'Новий текст',
      answerText: 'Джеймс Кемерон',
      explanation: 'Фільм 1997 року.',
    });
    expect(category.questions[0]).toBe(doc.rounds[0]!.categories[0]!.questions[0]);
    expect(next.rounds[1]).toBe(doc.rounds[1]);
  });

  it('keeps pictures while the answer stays, and drops them when it changes', () => {
    const kept = applyEdit(quiz(), at, one('Інакше', ' джеймс кемерон '));
    expect(kept.rounds[0]!.categories[0]!.questions[1]).toMatchObject({
      imagePath: 'q/old.webp',
      answerImagePath: 'q/answer.webp',
    });
    const changed = applyEdit(quiz(), at, one('Інше', 'Стівен Спілберг', { explanation: '' }));
    expect(changed.rounds[0]!.categories[0]!.questions[1]).toMatchObject({
      imagePath: null,
      answerImagePath: null,
      explanation: '',
    });
    const photo = applyEdit(quiz(), at, one('Інше', 'Інше', { imagePath: 'q/new.webp' }));
    expect(photo.rounds[0]!.categories[0]!.questions[1]!.imagePath).toBe('q/new.webp');
  });

  it('renames a category it rewrites', () => {
    const doc = quiz();
    const written = editSource(doc, { round: 0, category: 1 })!.map((c) => ({
      title: 'Джаз',
      questions: c.questions.map((_, i) => ({ text: `П${i}`, answer: `В${i}` })),
    }));
    const next = applyEdit(doc, { round: 0, category: 1 }, { categories: written });
    expect(next.rounds[0]!.categories[1]!.title).toBe('Джаз');
    expect(next.rounds[0]!.categories[0]).toBe(doc.rounds[0]!.categories[0]);
  });
});

describe('restoreEdit', () => {
  it('brings back the target and keeps later changes elsewhere', () => {
    const before = quiz();
    const edited = applyEdit(before, { round: 0, category: 0, question: 1 }, one('Нове', 'Нове'));
    const later = updateCategory(edited, 1, 0, (c) => ({ ...c, title: 'Футбол' }));
    const undone = restoreEdit(later, { round: 0, category: 0, question: 1 }, before);
    expect(undone.rounds[0]!.categories[0]!.questions[1]).toEqual(
      before.rounds[0]!.categories[0]!.questions[1],
    );
    expect(undone.rounds[1]!.categories[0]!.title).toBe('Футбол');
  });

  it('brings back a whole round', () => {
    const before = quiz();
    const edited = updateCategory(before, 0, 3, (c) => ({ ...c, title: 'Інше' }));
    expect(restoreEdit(edited, { round: 0 }, before).rounds[0]).toEqual(before.rounds[0]);
  });
});
