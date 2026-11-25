import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    name: 'Квіз із друзями',
    titles: {
      quizzes: 'Мої квізи',
      editor: 'Редактор',
      host: 'Ведучий',
      play: 'Гра',
      stream: 'Трансляція',
    } as Record<string, string>,
    loading: 'Завантажуємо сторінку…',
    notifications: 'Сповіщення',
    close: 'Закрити',
    newVersion: 'Є нова версія',
    update: 'Оновити',
  },
  en: {
    name: 'Quiz with friends',
    titles: {
      quizzes: 'My quizzes',
      editor: 'Editor',
      host: 'Host',
      play: 'Game',
      stream: 'Stream',
    },
    loading: 'Loading the page…',
    notifications: 'Notifications',
    close: 'Close',
    newVersion: 'A new version is ready',
    update: 'Update',
  },
});
