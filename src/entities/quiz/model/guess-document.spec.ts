import {
  addGuess,
  applyGeneratedGuesses,
  emptyGuessQuiz,
  guessProgress,
  removeGuess,
  updateGuess,
} from './guess-document';
import { parseQuizDocument } from './quiz-document';
import { QuizImportError } from './quiz-import-error';
import { documentProgress, emptyDocument, kindOf } from './quiz-kind';

describe('guess document', () => {
  it('starts with ten empty questions and a clock', () => {
    const quiz = emptyGuessQuiz('Числа');
    expect(quiz.guesses).toHaveLength(10);
    expect(quiz.guessSeconds).toBe(30);
    expect(kindOf(emptyDocument('guess', 'Числа'))).toBe('guess');
  });

  it('counts a question with a text and a number, zero included', () => {
    let quiz = updateGuess(emptyGuessQuiz('Числа'), 0, { text: 'Скільки?' });
    expect(guessProgress(quiz).complete).toBe(0);
    quiz = updateGuess(quiz, 0, { answer: 0 });
    expect(documentProgress(quiz)).toEqual({ complete: 1, total: 10, missingTitles: 0 });
  });

  it('holds at most twenty questions', () => {
    let quiz = emptyGuessQuiz('Числа');
    for (let i = 0; i < 15; i += 1) quiz = addGuess(quiz);
    expect(quiz.guesses).toHaveLength(20);
    expect(removeGuess(quiz, 0).guesses).toHaveLength(19);
  });

  it('imports an exported quiz and explains a wrong one', () => {
    const quiz = updateGuess(emptyGuessQuiz('Числа'), 0, { text: 'Скільки?', answer: -1.5 });
    expect(parseQuizDocument(JSON.stringify(quiz), 'id').document).toEqual(quiz);
    const broken = { ...quiz, guesses: [{ text: 'Скільки?', answer: 'багато' }] };
    const parse = () => parseQuizDocument(JSON.stringify(broken), 'id');
    expect(parse).toThrow(QuizImportError);
    expect(parse).toThrow('number');
  });

  it('takes the AI’s questions', () => {
    const quiz = applyGeneratedGuesses(emptyGuessQuiz('Числа'), {
      categories: [
        {
          title: 'x',
          questions: [{ text: 'Висота?', answer: '8848.86', unit: 'м', explanation: 'Так.' }],
        },
      ],
    });
    expect(quiz.guesses).toEqual([
      { text: 'Висота?', answer: 8848.86, unit: 'м', explanation: 'Так.' },
    ]);
  });
});
