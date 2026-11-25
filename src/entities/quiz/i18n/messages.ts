import { defineMessages } from '@shared/i18n';
import type { ImportPlace, ImportProblem } from '../model/quiz-import-error';

export const MESSAGES = defineMessages({
  uk: {
    auto: 'Авто',
    importProblem: {
      not_json: 'Файл не є коректним JSON',
      round_count: 'Кількість раундів не збігається з кількістю множників',
      text: 'очікується текст',
      positive_int: 'очікується додатне ціле число',
      seconds: 'очікується від 5 до 300 секунд',
      list: 'очікується список',
      object: "очікується об'єкт",
      board_file: 'Це файл «Своєї гри». Створіть для нього квіз цього типу.',
      bluff_file: 'Це файл гри «Варіанти». Створіть для нього квіз цього типу.',
    } satisfies Record<ImportProblem, string> as Record<ImportProblem, string>,
    importPlace: ({ field, round, category, question, fact }: ImportPlace) =>
      [
        field,
        round && `Раунд ${round}`,
        category && `категорія ${category}`,
        question && `питання ${question}`,
        fact && `Факт ${fact}`,
      ]
        .filter(Boolean)
        .join(', ') || 'Квіз',
  },
  en: {
    auto: 'Auto',
    importProblem: {
      not_json: 'The file is not valid JSON',
      round_count: 'The number of rounds does not match the number of multipliers',
      text: 'text expected',
      positive_int: 'a positive whole number expected',
      seconds: '5 to 300 seconds expected',
      list: 'a list expected',
      object: 'an object expected',
      board_file: 'This is a Quiz Board file. Create a quiz of that kind for it.',
      bluff_file: 'This is a Bluff file. Create a quiz of that kind for it.',
    },
    importPlace: ({ field, round, category, question, fact }) =>
      [
        field,
        round && `Round ${round}`,
        category && `category ${category}`,
        question && `question ${question}`,
        fact && `Fact ${fact}`,
      ]
        .filter(Boolean)
        .join(', ') || 'Quiz',
  },
});
