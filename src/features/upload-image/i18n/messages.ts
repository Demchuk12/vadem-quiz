import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    remove: 'Прибрати картинку',
    uploading: 'Завантажуємо…',
    compressed: 'Стиснемо до WebP, 1280 px',
    failed: 'Не вдалося завантажити картинку',
    rejected: 'Цей файл не підходить',
    rejectedText: 'Потрібна картинка до 30 МБ.',
  },
  en: {
    remove: 'Remove the picture',
    uploading: 'Uploading…',
    compressed: 'Compressed to WebP, 1280 px',
    failed: 'Could not upload the picture',
    rejected: 'This file does not fit',
    rejectedText: 'A picture of up to 30 MB is needed.',
  },
});
