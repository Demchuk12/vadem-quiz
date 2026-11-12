import {
  addFact,
  bluffProgress,
  emptyBluffQuiz,
  isBluff,
  removeFact,
  updateFact,
} from './bluff-document';
import { emptyQuiz, parseQuizDocument } from './quiz-document';

describe('bluff document', () => {
  it('starts with ten empty facts', () => {
    const quiz = emptyBluffQuiz('Факти');
    expect(quiz.facts).toHaveLength(10);
    expect(bluffProgress(quiz)).toEqual({ complete: 0, total: 10, missingTitles: 0 });
  });

  it('counts a fact only with its text, truth and decoy', () => {
    let quiz = updateFact(emptyBluffQuiz('Факти'), 0, { text: 'Готель з', truth: 'льоду' });
    expect(bluffProgress(quiz).complete).toBe(0);
    quiz = updateFact(quiz, 0, { decoy: 'соломи' });
    expect(bluffProgress(quiz).complete).toBe(1);
  });

  it('holds at most twenty facts', () => {
    let quiz = emptyBluffQuiz('Факти');
    for (let i = 0; i < 15; i += 1) quiz = addFact(quiz);
    expect(quiz.facts).toHaveLength(20);
    expect(removeFact(quiz, 0).facts).toHaveLength(19);
  });

  it('tells the two kinds apart', () => {
    expect(isBluff(emptyBluffQuiz('Факти'))).toBe(true);
    expect(isBluff(emptyQuiz('Дошка'))).toBe(false);
  });

  it('imports an exported bluff quiz', () => {
    const quiz = updateFact(emptyBluffQuiz('Факти'), 0, { text: 'Готель з', truth: 'льоду' });
    const { document } = parseQuizDocument(JSON.stringify(quiz), 'quiz');
    expect(document).toEqual(quiz);
  });
});
