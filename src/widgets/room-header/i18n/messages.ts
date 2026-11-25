import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: { sound: (on: boolean) => `Звук: ${on ? 'увімкнено' : 'вимкнено'}` },
  en: { sound: (on) => `Sound: ${on ? 'on' : 'off'}` },
});
