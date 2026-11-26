import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    heading: 'Новий квіз',
    games: { board: 'Своя гра', bluff: 'Варіанти', guess: 'На око', estate: 'Господар' },
    boardAbout: 'Дошка з категоріями: хто перший натисне кнопку, той і відповідає.',
    boardMeta: 'Раунди · категорії · бали за складність',
    bluffAbout: 'Вигадайте правдоподібну брехню, вгадайте правду і заплутайте друзів.',
    bluffMeta: (min: number, max: number) => `Від 3 гравців · ${min}–${max} фактів`,
    bluffOptions: { lie: 'старих трамваїв', truth: 'льоду', decoy: 'соломи' },
    guessAbout: 'Скільки? Яка відстань? Якого року? Хто ближче до числа, той і виграв.',
    guessMeta: (min: number, max: number) => `Від 2 гравців · ${min}–${max} питань`,
    estateAbout:
      'Купуйте міста на мапі України, беріть оренду, будуйте хати й торгуйтеся з друзями.',
    estateMeta: 'Від 2 до 8 гравців · кожен зі свого телефона',
    dialog: (game: string) => `Новий квіз · ${game}`,
    title: 'Назва квізу',
    titleError: 'Вкажіть назву.',
    cancel: 'Скасувати',
    create: 'Створити',
  },
  en: {
    heading: 'New quiz',
    games: { board: 'Quiz Board', bluff: 'Bluff', guess: 'Ballpark', estate: 'Landlord' },
    boardAbout: 'A board of categories: whoever presses the button first gets to answer.',
    boardMeta: 'Rounds · categories · points for difficulty',
    bluffAbout: 'Make up a believable lie, find the truth and fool your friends.',
    bluffMeta: (min, max) => `3 players or more · ${min}–${max} facts`,
    bluffOptions: { lie: 'old trams', truth: 'ice', decoy: 'straw' },
    guessAbout: 'How many? How far? What year? Whoever is closest to the number wins.',
    guessMeta: (min, max) => `2 players or more · ${min}–${max} questions`,
    estateAbout:
      'Buy cities on the map of Ukraine, charge rent, build houses and trade with friends.',
    estateMeta: '2 to 8 players · each on their own phone',
    dialog: (game) => `New quiz · ${game}`,
    title: 'Quiz title',
    titleError: 'Enter a title.',
    cancel: 'Cancel',
    create: 'Create',
  },
});
