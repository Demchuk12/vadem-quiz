import {
  QuizImportError,
  addCategory,
  emptyQuiz,
  parseQuizDocument,
  pointsOf,
  quizProgress,
  removeCategory,
  updateCategory,
  updateQuestion,
} from './quiz-document';

const fill = (title: string) => {
  let doc = emptyQuiz(title);
  doc.rounds.forEach((round, r) =>
    round.categories.forEach((category, c) => {
      doc = updateCategory(doc, r, c, (cat) => ({ ...cat, title: 'Cat' }));
      category.questions.forEach((_, q) => {
        doc = updateQuestion(
          doc,
          { round: r, category: c, question: q },
          {
            text: 'Q',
            answerText: 'A',
          },
        );
      });
    }),
  );
  return doc;
};

describe('emptyQuiz', () => {
  it('follows the plan: three rounds, five values, x1 x2 x3', () => {
    const doc = emptyQuiz('T');
    expect(doc.rounds).toHaveLength(3);
    expect(doc.rounds[0]!.categories[0]!.questions.map((q) => q.basePoints)).toEqual([
      200, 400, 600, 800, 1000,
    ]);
    expect(pointsOf(1000, 2, doc)).toBe(3000);
    expect(pointsOf(200, 1, doc)).toBe(400);
  });
});

describe('editing', () => {
  it('is immutable', () => {
    const doc = emptyQuiz('T');
    const next = updateQuestion(doc, { round: 0, category: 0, question: 0 }, { text: 'Q' });
    expect(next.rounds[0]!.categories[0]!.questions[0]!.text).toBe('Q');
    expect(doc.rounds[0]!.categories[0]!.questions[0]!.text).toBe('');
    expect(next.rounds[1]).toBe(doc.rounds[1]);
  });

  it('adds and removes categories in one round only', () => {
    const doc = emptyQuiz('T');
    expect(addCategory(doc, 1).rounds[1]!.categories).toHaveLength(6);
    expect(removeCategory(doc, 1, 0).rounds[1]!.categories).toHaveLength(4);
    expect(removeCategory(doc, 1, 0).rounds[0]!.categories).toHaveLength(5);
  });
});

describe('completeness', () => {
  it('counts questions and blank titles', () => {
    expect(quizProgress(emptyQuiz('T'))).toEqual({ complete: 0, total: 75, missingTitles: 15 });
  });

  it('counts a question complete with an image in place of text', () => {
    const done = fill('T');
    const withImage = updateQuestion(
      done,
      { round: 0, category: 0, question: 0 },
      { text: '', imagePath: 'x/y.webp' },
    );
    expect(quizProgress(withImage).complete).toBe(75);
    const blank = updateQuestion(done, { round: 0, category: 0, question: 0 }, { answerText: ' ' });
    expect(quizProgress(blank).complete).toBe(74);
  });
});

describe('parseQuizDocument', () => {
  const file = (patch: object = {}) =>
    JSON.stringify({
      title: 'T',
      roundMultipliers: [1],
      rounds: [
        {
          categories: [
            {
              title: 'C',
              questions: [{ basePoints: 200, text: 'Q', answerText: 'A' }],
            },
          ],
        },
      ],
      ...patch,
    });

  it('round-trips an exported document', () => {
    const doc = fill('T');
    expect(parseQuizDocument(JSON.stringify(doc), 'id').document).toEqual(doc);
  });

  it('fills in optional fields', () => {
    const { document } = parseQuizDocument(file(), 'id');
    expect(document.rounds[0]!.categories[0]!.questions[0]!.imagePath).toBeNull();
  });

  it('keeps images of this quiz and drops others, counting them', () => {
    const { document, droppedImages } = parseQuizDocument(
      JSON.stringify({
        title: 'T',
        roundMultipliers: [1],
        rounds: [
          {
            categories: [
              {
                title: 'C',
                questions: [
                  { basePoints: 200, text: 'Q', answerText: 'A', imagePath: 'id/a.webp' },
                  { basePoints: 400, text: 'Q', answerText: 'A', imagePath: 'other/b.webp' },
                ],
              },
            ],
          },
        ],
      }),
      'id',
    );
    expect(droppedImages).toBe(1);
    const [own, foreign] = document.rounds[0]!.categories[0]!.questions;
    expect(own!.imagePath).toBe('id/a.webp');
    expect(foreign!.imagePath).toBeNull();
  });

  it.each([
    ['broken JSON', '{'],
    ['not an object', '[]'],
    ['mismatched multipliers', file({ roundMultipliers: [1, 2] })],
    ['zero multiplier', file({ roundMultipliers: [0] })],
    ['no rounds', file({ rounds: [], roundMultipliers: [] })],
    [
      'bad points',
      file({
        rounds: [{ categories: [{ title: 'C', questions: [{ basePoints: -1, text: 'Q' }] }] }],
      }),
    ],
  ])('rejects %s', (_, json) => {
    expect(() => parseQuizDocument(json, 'id')).toThrow(QuizImportError);
  });
});
