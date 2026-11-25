import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    open: 'Відкрити відповіді',
    nobodyLeft: 'Усі вже відповідали',
    waiting: 'Чекаємо на натискання',
    answers: (nickname: string) => `${nickname} відповідає`,
    correct: 'Правильно',
    wrong: 'Неправильно',
    toBoard: 'До дошки',
    skip: 'Пропустити',
  },
  en: {
    open: 'Open the buzzers',
    nobodyLeft: 'Everyone has had a try',
    waiting: 'Waiting for a press',
    answers: (nickname) => `${nickname} is answering`,
    correct: 'Correct',
    wrong: 'Wrong',
    toBoard: 'Back to the board',
    skip: 'Skip',
  },
});
