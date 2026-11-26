import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    label: (cell: string) => `Дії з ділянкою «${cell}»`,
    build: (cost: string) => `Звести хату · ${cost}`,
    buildManor: (cost: string) => `Звести садибу · ${cost}`,
    sell: (amount: string) => `Продати хату · +${amount}`,
    mortgage: (amount: string) => `Закласти · +${amount}`,
    redeem: (amount: string) => `Викупити · ${amount}`,
    notNow: 'Будувати, продавати й закладати можна у свій хід.',
  },
  en: {
    label: (cell) => `Actions on ${cell}`,
    build: (cost) => `Build a house · ${cost}`,
    buildManor: (cost) => `Build a manor · ${cost}`,
    sell: (amount) => `Sell a house · +${amount}`,
    mortgage: (amount) => `Mortgage · +${amount}`,
    redeem: (amount) => `Redeem · ${amount}`,
    notNow: 'You build, sell and mortgage on your own turn.',
  },
});
