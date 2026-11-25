import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    heading: 'Новий квіз',
    games: { board: 'Своя гра', bluff: 'Варіанти' },
    boardAbout: 'Дошка з категоріями: хто перший натисне кнопку, той і відповідає.',
    boardMeta: 'Раунди · категорії · бали за складність',
    bluffAbout: 'Вигадайте правдоподібну брехню, вгадайте правду і заплутайте друзів.',
    bluffMeta: (min: number, max: number) => `Від 3 гравців · ${min}–${max} фактів`,
    bluffOptions: { lie: 'старих трамваїв', truth: 'льоду', decoy: 'соломи' },
    dialog: (game: string) => `Новий квіз · ${game}`,
    title: 'Назва квізу',
    titleError: 'Вкажіть назву.',
    cancel: 'Скасувати',
    create: 'Створити',
  },
  en: {
    heading: 'New quiz',
    games: { board: 'Quiz Board', bluff: 'Bluff' },
    boardAbout: 'A board of categories: whoever presses the button first gets to answer.',
    boardMeta: 'Rounds · categories · points for difficulty',
    bluffAbout: 'Make up a believable lie, find the truth and fool your friends.',
    bluffMeta: (min, max) => `3 players or more · ${min}–${max} facts`,
    bluffOptions: { lie: 'old trams', truth: 'ice', decoy: 'straw' },
    dialog: (game) => `New quiz · ${game}`,
    title: 'Quiz title',
    titleError: 'Enter a title.',
    cancel: 'Cancel',
    create: 'Create',
  },
});
