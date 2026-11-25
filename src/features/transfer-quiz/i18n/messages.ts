import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    import: 'Імпорт',
    importLabel: 'Імпорт квізу з JSON',
    export: 'Експорт',
    done: 'Квіз імпортовано, збережіть його',
    dropped: (count: number) =>
      `Картинок з іншого квізу прибрано: ${count}. Їх треба завантажити знову.`,
    failed: 'Імпорт не вдався',
    unreadable: 'Не вдалося прочитати файл',
  },
  en: {
    import: 'Import',
    importLabel: 'Import a quiz from JSON',
    export: 'Export',
    done: 'The quiz is imported, save it',
    dropped: (count) => `Pictures of another quiz removed: ${count}. Upload them again.`,
    failed: 'The import failed',
    unreadable: 'Could not read the file',
  },
});
