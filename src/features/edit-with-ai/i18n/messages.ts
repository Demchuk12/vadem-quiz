import { defineMessages, plural } from '@shared/i18n';
import type { AiEditKind, KindTexts } from '../model/edit-kinds.types';

export const MESSAGES = defineMessages({
  uk: {
    working: 'AI переписує…',
    chips: 'Швидкі варіанти',
    instruction: 'Що змінити',
    change: 'Змінити',
    undo: 'Скасувати',
    label: (title: string) => `${title} з AI`,
    category: (number: number) => `Категорія ${number}`,
    quoted: (title: string) => `«${title}»`,
    points: (count: number) =>
      `${count} ${plural('uk', count, { one: 'очко', few: 'очки', other: 'очок' })}`,
    questions: (count: number) => `питань: ${count}`,
    roundShape: (categories: number, questions: number) =>
      `Категорій: ${categories} · питань у кожній: ${questions}`,
    uneven: 'Раунд не вийде змінити цілком',
    unevenText: 'У його категоріях різна кількість питань. Змініть категорії по одній.',
    doneText: (writer: string) => `Писав ${writer}. Перевірте й збережіть квіз.`,
    failed: 'Не вдалося змінити',
    kinds: {
      question: {
        title: 'Змінити питання',
        done: 'Питання змінено',
        placeholder: 'Наприклад: спитай про інший фільм цього режисера',
        chips: [
          { label: 'Простіше', text: 'Зроби питання простішим.' },
          { label: 'Складніше', text: 'Зроби питання складнішим.' },
          { label: 'Інше питання', text: 'Заміни на інше питання тієї ж складності.' },
          { label: 'Пояснення', text: 'Додай коротке пояснення відповіді.' },
          { label: 'Фото до відповіді', text: 'Додай фото до відповіді.' },
        ],
      },
      category: {
        title: 'Змінити категорію',
        done: 'Категорію змінено',
        placeholder: 'Наприклад: тільки українські виконавці',
        chips: [
          { label: 'Простіше', text: 'Зроби питання категорії простішими.' },
          { label: 'Складніше', text: 'Зроби питання категорії складнішими.' },
          { label: 'Нові питання', text: 'Напиши нові питання на цю ж тему.' },
          { label: 'Інша тема', text: 'Заміни тему категорії на іншу, близьку до решти квізу.' },
          { label: 'Пояснення', text: 'Додай коротке пояснення до кожної відповіді.' },
        ],
      },
      round: {
        title: 'Змінити раунд',
        done: 'Раунд змінено',
        placeholder: 'Наприклад: більше питань про 90-ті',
        chips: [
          { label: 'Простіше', text: 'Зроби питання раунду простішими.' },
          { label: 'Складніше', text: 'Зроби питання раунду складнішими.' },
          { label: 'Нові питання', text: 'Напиши нові питання для всього раунду.' },
          { label: 'Пояснення', text: 'Додай коротке пояснення до кожної відповіді.' },
          { label: 'Фото до відповідей', text: 'Додай фото до відповідей частини питань.' },
        ],
      },
    } as Record<AiEditKind, KindTexts>,
  },
  en: {
    working: 'The AI is rewriting…',
    chips: 'Quick options',
    instruction: 'What to change',
    change: 'Change',
    undo: 'Undo',
    label: (title) => `${title} with AI`,
    category: (number) => `Category ${number}`,
    quoted: (title) => `“${title}”`,
    points: (count) => `${count} ${plural('en', count, { one: 'point', other: 'points' })}`,
    questions: (count) => `questions: ${count}`,
    roundShape: (categories, questions) =>
      `Categories: ${categories} · questions in each: ${questions}`,
    uneven: 'The round cannot be changed as a whole',
    unevenText: 'Its categories have different numbers of questions. Change them one by one.',
    doneText: (writer) => `Written by ${writer}. Check it and save the quiz.`,
    failed: 'Could not change it',
    kinds: {
      question: {
        title: 'Change the question',
        done: 'The question is changed',
        placeholder: 'For example: ask about another film by this director',
        chips: [
          { label: 'Easier', text: 'Make the question easier.' },
          { label: 'Harder', text: 'Make the question harder.' },
          { label: 'Another question', text: 'Replace it with another question as hard as this.' },
          { label: 'Explanation', text: 'Add a short explanation of the answer.' },
          { label: 'Photo of the answer', text: 'Add a photo to the answer.' },
        ],
      },
      category: {
        title: 'Change the category',
        done: 'The category is changed',
        placeholder: 'For example: only British bands',
        chips: [
          { label: 'Easier', text: 'Make the questions of the category easier.' },
          { label: 'Harder', text: 'Make the questions of the category harder.' },
          { label: 'New questions', text: 'Write new questions on the same topic.' },
          {
            label: 'Another topic',
            text: 'Replace the topic of the category with another, close to the rest of the quiz.',
          },
          { label: 'Explanations', text: 'Add a short explanation to every answer.' },
        ],
      },
      round: {
        title: 'Change round',
        done: 'The round is changed',
        placeholder: 'For example: more questions about the 90s',
        chips: [
          { label: 'Easier', text: 'Make the questions of the round easier.' },
          { label: 'Harder', text: 'Make the questions of the round harder.' },
          { label: 'New questions', text: 'Write new questions for the whole round.' },
          { label: 'Explanations', text: 'Add a short explanation to every answer.' },
          { label: 'Photos of answers', text: 'Add photos to the answers of some questions.' },
        ],
      },
    },
  },
});
