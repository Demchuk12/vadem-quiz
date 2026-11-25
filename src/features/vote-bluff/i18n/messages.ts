import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    prompt: 'Яке закінчення правдиве?',
    options: 'Варіанти',
    counted: 'Голос враховано. Можна передумати, поки йде час.',
    voted: (done: number, total: number) => `Проголосували ${done} з ${total}`,
  },
  en: {
    prompt: 'Which ending is true?',
    options: 'Answers',
    counted: 'Your vote counts. You may change it while there is time.',
    voted: (done, total) => `Voted: ${done} of ${total}`,
  },
});
