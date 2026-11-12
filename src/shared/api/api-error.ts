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
  too_few_facts: 'Для гри «Варіанти» потрібно щонайменше 5 фактів.',
  not_enough_players: 'Для гри «Варіанти» потрібно щонайменше 3 гравці.',
  invalid_bluff: 'Напишіть свій варіант: від 1 до 80 символів.',
  own_option: 'За свій варіант голосувати не можна.',
  option_not_found: 'Цього варіанта вже немає. Оберіть інший.',
  invalid_prompt: 'Опишіть тему квізу: від 3 до 1500 символів.',
  ai_limit: 'Ліміт AI на сьогодні вичерпано. Спробуйте завтра.',
  ai_busy: 'AI зараз перевантажений. Спробуйте за хвилину.',
  ai_failed: 'AI не зміг написати питання. Спробуйте ще раз або змініть тему.',
  ai_key_invalid: 'Провайдер не прийняв ключ. Перевірте його в кабінеті провайдера.',
  ai_no_credit:
    'Провайдер відмовив через оплату: на рахунку закінчились кошти або не підключено платежі.',
  network: "Немає зв'язку із сервером. Спробуйте ще раз.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Щось пішло не так.';
  return 'Щось пішло не так.';
}
