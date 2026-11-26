import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    pick: 'Натисніть клітинку, щоб побачити її картку.',
    remove: (nickname: string) => `Вилучити з гри: ${nickname}`,
    removeTitle: (nickname: string) => `Вилучити ${nickname} з гри?`,
    removeText: 'Гравець вибуде, а його ділянки стануть вільними.',
    confirm: 'Вилучити',
    cancel: 'Скасувати',
  },
  en: {
    pick: 'Click a cell to see its card.',
    remove: (nickname) => `Remove from the game: ${nickname}`,
    removeTitle: (nickname) => `Remove ${nickname} from the game?`,
    removeText: 'The player is out, and their land becomes free.',
    confirm: 'Remove',
    cancel: 'Cancel',
  },
});
