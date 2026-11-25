import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    roundOver: (round: number) => `Раунд ${round} завершено`,
    whoIsFirst: 'Хто перший?',
    answers: (nickname: string) => `${nickname} відповідає`,
    write: 'Вигадайте своє закінчення',
    guess: 'Хто ближче?',
    score: 'Рахунок',
  },
  en: {
    roundOver: (round) => `Round ${round} is over`,
    whoIsFirst: 'Who is first?',
    answers: (nickname) => `${nickname} is answering`,
    write: 'Make up your ending',
    guess: 'Who is closest?',
    score: 'Score',
  },
});
