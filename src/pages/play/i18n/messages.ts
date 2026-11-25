import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    leave: 'Вийти з гри',
    yourScore: 'Ваш рахунок',
    inRoom: (code: string) => `Ви в кімнаті ${code}`,
    waitForStart: 'Гра почнеться, щойно ведучий її запустить.',
    hostPicks: 'Ведучий обирає питання.',
    roundOver: (round: number) => `Раунд ${round} завершено`,
  },
  en: {
    leave: 'Leave the game',
    yourScore: 'Your score',
    inRoom: (code) => `You are in room ${code}`,
    waitForStart: 'The game begins as soon as the host starts it.',
    hostPicks: 'The host is picking a question.',
    roundOver: (round) => `Round ${round} is over`,
  },
});
