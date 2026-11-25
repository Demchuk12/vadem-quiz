import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    label: 'Ваш варіант',
    hint: 'Вигадайте закінчення, у яке повірять інші.',
    required: 'Напишіть свій варіант.',
    send: 'Надіслати',
    change: 'Змінити',
    sent: (text: string) => `Надіслано: «${text}». Можна змінити, поки йде час.`,
    wrote: (done: number, total: number) => `Написали ${done} з ${total}`,
  },
  en: {
    label: 'Your answer',
    hint: 'Make up an ending the others will believe.',
    required: 'Write your answer.',
    send: 'Send',
    change: 'Change',
    sent: (text) => `Sent: “${text}”. You may change it while there is time.`,
    wrote: (done, total) => `Written: ${done} of ${total}`,
  },
});
