import { defineMessages } from '@shared/i18n';

export const MESSAGES = defineMessages({
  uk: {
    code: 'Код кімнати',
    codeError: (length: number) => `Код складається з ${length} символів.`,
    nickname: 'Нікнейм',
    nicknameError: 'Вкажіть нікнейм, до 24 символів.',
    join: 'Приєднатися',
  },
  en: {
    code: 'Room code',
    codeError: (length) => `The code has ${length} characters.`,
    nickname: 'Nickname',
    nicknameError: 'Enter a nickname, up to 24 characters.',
    join: 'Join',
  },
});
