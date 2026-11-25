import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    empty: 'Квізів поки немає',
    emptyText: 'Створіть перший, щоб зібрати питання й запустити гру.',
    games: { bluff: 'Варіанти', guess: 'На око' },
    game: (code: string) => `Гра ${code}`,
    edit: 'Редагувати',
  },
  en: {
    empty: 'No quizzes yet',
    emptyText: 'Create the first one to collect questions and start a game.',
    games: { bluff: 'Bluff', guess: 'Ballpark' },
    game: (code) => `Game ${code}`,
    edit: 'Edit',
  },
});
