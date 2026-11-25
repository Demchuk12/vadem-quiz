import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    label: (title: string) => `Видалити: ${title}`,
    title: 'Видалити квіз?',
    text: (title: string) => `«${title}» зникне назавжди. Ігри, що вже йдуть, не постраждають.`,
    confirm: 'Видалити',
    cancel: 'Скасувати',
  },
  en: {
    label: (title) => `Delete: ${title}`,
    title: 'Delete the quiz?',
    text: (title) => `“${title}” will be gone for good. Games already running are not affected.`,
    confirm: 'Delete',
    cancel: 'Cancel',
  },
});
