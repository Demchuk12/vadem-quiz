import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    title: 'Назва квізу',
    clock: 'Обмежити час на відповідь',
    clockSeconds: 'Секунд на відповідь',
    about:
      'Кожне питання — раунд, а відповідь на нього — число. Найкраще працюють питання, які важко знати точно, але цікаво прикинути. За останнє бали подвоюються.',
    question: (number: number) => `Питання ${number}`,
    incomplete: 'не заповнено',
    remove: (number: number) => `Видалити питання ${number}`,
    add: 'Додати питання',
    text: 'Питання',
    textHint: 'Наприклад: «Скільки сходинок в Ейфелевій вежі?»',
    answer: 'Правильне число',
    answerError: 'Введіть число до трильйона, наприклад 1665 або 3,5.',
    unit: 'Одиниці',
    unitHint: 'Необовʼязково: км, років, грн.',
    explanation: 'Пояснення',
    explanationHint: 'Необовʼязково. Гравці побачать його разом із відповіддю.',
    count: (count: number, max: number, min: number) =>
      `${count} з ${max} · для гри потрібно щонайменше ${min}`,
  },
  en: {
    title: 'Quiz title',
    clock: 'Limit the time to answer',
    clockSeconds: 'Seconds to answer',
    about:
      'Every question is a round, and its answer is a number. Questions that are hard to know exactly but fun to estimate work best. The last one counts double.',
    question: (number) => `Question ${number}`,
    incomplete: 'not filled in',
    remove: (number) => `Delete question ${number}`,
    add: 'Add a question',
    text: 'Question',
    textHint: 'For example: “How many steps does the Eiffel Tower have?”',
    answer: 'Right number',
    answerError: 'Enter a number up to a trillion, like 1665 or 3.5.',
    unit: 'Units',
    unitHint: 'Optional: km, years, dollars.',
    explanation: 'Explanation',
    explanationHint: 'Optional. The players see it with the answer.',
    count: (count, max, min) => `${count} of ${max} · a game needs at least ${min}`,
  },
});
