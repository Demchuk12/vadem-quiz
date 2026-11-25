import { defineMessages } from '../../i18n';

export const MESSAGES = defineMessages({
  uk: {
    clock: {
      range: (min: number, max: number) => `Від ${min} до ${max}`,
      less: 'Менше',
      more: 'Більше',
      manual: 'Без таймера: далі гру веде ведучий кнопками.',
    },
    joinQr: (url: string) => `QR-код для входу: ${url}`,
  },
  en: {
    clock: {
      range: (min, max) => `From ${min} to ${max}`,
      less: 'Less',
      more: 'More',
      manual: 'No timer: the host moves the game on with the buttons.',
    },
    joinQr: (url) => `QR code to join: ${url}`,
  },
});
