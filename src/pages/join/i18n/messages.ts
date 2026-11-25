import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    title: 'Квіз із друзями',
    tagline: 'Хто перший натиснув, той і відповідає.',
    join: 'Приєднатися до гри',
    hint: 'Введіть код кімнати від ведучого й оберіть нікнейм.',
    back: (code: string) => `Повернутися до гри ${code}`,
  },
  en: {
    title: 'Quiz with friends',
    tagline: 'Whoever presses first gets to answer.',
    join: 'Join a game',
    hint: 'Enter the room code from your host and pick a nickname.',
    back: (code) => `Back to game ${code}`,
  },
});
