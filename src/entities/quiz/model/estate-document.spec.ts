import { ESTATE_LAYOUT } from '../config/estate-board';
import {
  MOVE_TARGETS,
  addCard,
  emptyEstateQuiz,
  estateProgress,
  removeCard,
  renameCell,
  setEnd,
  updateCard,
} from './estate-document';
import { parseQuizDocument } from './quiz-document';
import { QuizImportError } from './quiz-import-error';
import { emptyDocument, kindOf } from './quiz-kind';

describe('estate document', () => {
  it('starts as a ready map of Ukraine in the host’s language', () => {
    const quiz = emptyEstateQuiz('Мапа');
    expect(quiz.regions).toHaveLength(8);
    expect(quiz.cells).toHaveLength(ESTATE_LAYOUT.length);
    expect(quiz.cells[31]).toBe('Київ');
    expect(emptyEstateQuiz('Map', 'en').cells[31]).toBe('Kyiv');
    expect(estateProgress(quiz).complete).toBe(estateProgress(quiz).total);
    expect(kindOf(emptyDocument('estate', 'Мапа', 'uk'))).toBe('estate');
  });

  it('counts an unnamed cell as missing', () => {
    const quiz = renameCell(emptyEstateQuiz('Мапа'), 5, ' ');
    expect(estateProgress(quiz).total - estateProgress(quiz).complete).toBe(1);
  });

  it('keeps a deck between one and sixteen cards', () => {
    let quiz = emptyEstateQuiz('Мапа');
    for (let i = 0; i < 10; i += 1) quiz = addCard(quiz, 'fate');
    expect(quiz.fate).toHaveLength(16);
    quiz = { ...quiz, community: quiz.community.slice(0, 1) };
    expect(removeCard(quiz, 'community', 0).community).toHaveLength(1);
  });

  it('starts a new end from its own default and keeps a value in range', () => {
    const quiz = emptyEstateQuiz('Мапа');
    expect(setEnd(quiz, 'minutes')).toMatchObject({ endKind: 'minutes', endValue: 60 });
    expect(setEnd(quiz, 'laps', 1000).endValue).toBe(100);
    expect(setEnd(quiz, 'last')).toMatchObject({ endKind: 'last', endValue: 0 });
  });

  it('sends no card to a card cell', () => {
    expect(MOVE_TARGETS).not.toContain(14);
    expect(MOVE_TARGETS).toContain(0);
  });

  it('imports an exported quiz and refuses a wrong card', () => {
    const quiz = updateCard(emptyEstateQuiz('Мапа'), 'fate', 0, {
      text: 'Ярмарок',
      effect: { kind: 'repairs', house: 100, manor: 400 },
    });
    expect(parseQuizDocument(JSON.stringify(quiz), 'id').document).toEqual(quiz);
    const broken = { ...quiz, fate: [{ text: 'x', effect: { kind: 'move', to: 14 } }] };
    expect(() => parseQuizDocument(JSON.stringify(broken), 'id')).toThrow(QuizImportError);
    const short = { ...quiz, cells: quiz.cells.slice(1) };
    expect(() => parseQuizDocument(JSON.stringify(short), 'id')).toThrow(QuizImportError);
  });
});
