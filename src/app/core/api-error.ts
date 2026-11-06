/** A failure reported by an RPC function (its short code) or by the network. */
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ApiError';
  }
}

const MESSAGES: Record<string, string> = {
  not_authorized: 'Немає доступу. Відкрийте сторінку на пристрої, де створили гру.',
  room_not_found: 'Кімнату з таким кодом не знайдено.',
  room_finished: 'Цю гру вже завершено.',
  room_full: 'У кімнаті вже максимум гравців.',
  nickname_taken: 'Цей нікнейм уже зайнято. Оберіть інший.',
  invalid_nickname: 'Нікнейм має містити від 1 до 24 символів.',
  invalid_title: 'Назва має містити від 1 до 120 символів.',
  invalid_document: 'Квіз містить некоректні дані.',
  invalid_image_path: 'Квіз посилається на картинку з іншого квізу.',
  quiz_incomplete: 'Квіз ще не заповнено: потрібні назви категорій, питання й відповіді.',
  invalid_state: 'Стан гри вже змінився. Спробуйте ще раз.',
  cell_not_available: 'Це питання вже зіграно або належить іншому раунду.',
  player_not_found: 'Гравця не знайдено.',
  invalid_delta: 'Вкажіть зміну очок, відмінну від нуля.',
  network: "Немає зв'язку із сервером. Спробуйте ще раз.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Щось пішло не так.';
  return 'Щось пішло не так.';
}

export function isApiError(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
