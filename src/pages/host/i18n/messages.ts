import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    notHost: 'Ви не ведучий цієї гри',
    notHostText: 'Панель керування відкривається лише на пристрої, де гру створили.',
    toQuizzes: 'До моїх квізів',
    stream: 'Екран для стріму',
    start: 'Почати гру',
    minPlayers: (count: number) => `Для гри «Варіанти» потрібно щонайменше ${count} гравці.`,
    endRound: 'Завершити раунд достроково',
    roundOver: (round: number) => `Раунд ${round} завершено`,
    nextRound: 'Наступний раунд',
    results: 'Підбити підсумки',
    score: 'Рахунок',
  },
  en: {
    notHost: 'You are not the host of this game',
    notHostText: 'The controls open only on the device that created the game.',
    toQuizzes: 'To my quizzes',
    stream: 'Stream screen',
    start: 'Start the game',
    minPlayers: (count) => `A Bluff game needs at least ${count} players.`,
    endRound: 'End the round early',
    roundOver: (round) => `Round ${round} is over`,
    nextRound: 'Next round',
    results: 'Show the results',
    score: 'Score',
  },
});
