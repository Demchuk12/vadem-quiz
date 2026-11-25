import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    label: (unit: string | null) => (unit ? `Ваше число, ${unit}` : 'Ваше число'),
    hint: 'Головне бути ближче за інших. Влучати точно не обовʼязково.',
    required: 'Введіть число, наприклад 1500 або 3,5.',
    understood: (number: string) => `Рахуємо як ${number}`,
    send: 'Надіслати',
    change: 'Змінити',
    sent: (number: string) => `Надіслано: ${number}. Можна змінити, поки йде час.`,
    answered: (done: number, total: number) => `Відповіли ${done} з ${total}`,
  },
  en: {
    label: (unit) => (unit ? `Your number, ${unit}` : 'Your number'),
    hint: 'Being closer than the others is enough. You need not be exact.',
    required: 'Enter a number, like 1500 or 3.5.',
    understood: (number) => `Counts as ${number}`,
    send: 'Send',
    change: 'Change',
    sent: (number) => `Sent: ${number}. You may change it while there is time.`,
    answered: (done, total) => `Answered: ${done} of ${total}`,
  },
});
