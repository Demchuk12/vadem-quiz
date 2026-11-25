import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    opening: 'Відкриваємо квіз…',
    forbidden: 'Цей квіз недоступний на цьому пристрої',
    forbiddenText: 'Доступ зберігається в браузері, де квіз створили.',
    toQuizzes: 'До моїх квізів',
    failed: 'Не вдалося завантажити квіз.',
    progress: (complete: number, total: number) => `Заповнено ${complete} з ${total}`,
    unsaved: 'є незбережені зміни',
    save: 'Зберегти',
    saved: 'Квіз збережено',
    saveFailed: 'Не вдалося зберегти',
  },
  en: {
    opening: 'Opening the quiz…',
    forbidden: 'This quiz is not available on this device',
    forbiddenText: 'Access lives in the browser where the quiz was created.',
    toQuizzes: 'To my quizzes',
    failed: 'Could not load the quiz.',
    progress: (complete, total) => `Filled in ${complete} of ${total}`,
    unsaved: 'unsaved changes',
    save: 'Save',
    saved: 'The quiz is saved',
    saveFailed: 'Could not save',
  },
});
