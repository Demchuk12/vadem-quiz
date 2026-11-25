import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    yourChance: 'Ваш шанс!',
    answer: 'Відповісти!',
    youAnswer: 'Ви відповідаєте!',
    spent: 'Спробу використано',
    sending: 'Надсилаємо…',
    someone: 'Хтось',
    answers: (nickname: string) => `${nickname} відповідає`,
    wait: 'Зачекайте',
    late: 'Ви запізнились на',
    close: 'Ледь-ледь!',
  },
  en: {
    yourChance: 'Your chance!',
    answer: 'Answer!',
    youAnswer: 'You are answering!',
    spent: 'You have had your try',
    sending: 'Sending…',
    someone: 'Someone',
    answers: (nickname) => `${nickname} is answering`,
    wait: 'Wait',
    late: 'You were late by',
    close: 'So close!',
  },
});
