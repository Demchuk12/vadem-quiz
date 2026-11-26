import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    title: (cell: string) => `Аукціон: «${cell}»`,
    price: (price: string) => `Ціна ділянки ${price}`,
    noBids: 'Ставок ще немає. Почніть від 10 ₴.',
    leader: (nickname: string, bid: string) => `Веде ${nickname}: ${bid}`,
    youLead: (bid: string) => `Ваша ставка веде: ${bid}`,
    raise: (amount: string) => `+${amount}`,
    bid: (amount: string) => `Ставка ${amount}`,
    bids: 'Підняти ставку',
    clock: 'Кожна ставка дає ще 10 секунд.',
  },
  en: {
    title: (cell) => `Auction: ${cell}`,
    price: (price) => `Land price ${price}`,
    noBids: 'No bids yet. Start from ₴10.',
    leader: (nickname, bid) => `${nickname} leads: ${bid}`,
    youLead: (bid) => `Your bid leads: ${bid}`,
    raise: (amount) => `+${amount}`,
    bid: (amount) => `Bid ${amount}`,
    bids: 'Raise the bid',
    clock: 'Every bid adds 10 seconds.',
  },
});
