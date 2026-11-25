import { defineMessages, plural } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    title: (nickname: string) => `Змінити очки: ${nickname}`,
    now: (count: number, shown: string) =>
      `Зараз ${shown} ${plural('uk', count, { one: 'очко', few: 'очки', other: 'очок' })}.`,
    by: 'На скільки змінити',
    hint: 'Від’ємне значення віднімає очки.',
    apply: 'Застосувати',
  },
  en: {
    title: (nickname) => `Change score: ${nickname}`,
    now: (count, shown) =>
      `Now ${shown} ${plural('en', count, { one: 'point', other: 'points' })}.`,
    by: 'Change by',
    hint: 'A negative number takes points away.',
    apply: 'Apply',
  },
});
