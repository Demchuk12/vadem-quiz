import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';
import { QUIZ_JSON, hostGame, joinGame } from './helpers';

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq', label: 'Groq' },
];

const buzzer = (page: Page) => page.locator('button.vd-buzzer');
const pressBuzzer = (page: Page) => buzzer(page).click({ force: true });
const score = (page: Page) => page.getByLabel('Ваш рахунок');

test('a full game: lobby, buzzer, judging, rounds, final standings', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  const bob = await joinGame(browser, code, 'Богдан');

  const streamContext = await browser.newContext();
  const stream = await streamContext.newPage();
  await stream.goto(`/stream/${code}`);
  await expect(stream.getByText(code, { exact: true }).first()).toBeVisible();

  // The lobby updates live on the host's screen.
  await expect(host.getByText('Анна')).toBeVisible();
  await expect(host.getByText('Богдан')).toBeVisible();
  await host.getByRole('button', { name: 'Почати гру' }).click();

  // Board: only the host can pick.
  await expect(ann.getByText('Ведучий обирає питання')).toBeVisible();
  await expect(ann.getByRole('group', { name: 'Географія' }).getByRole('button')).toHaveCount(0);
  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '200' }).click();

  // Question shown: everyone reads, nobody can press, and the answer is nowhere to be found.
  await expect(ann.getByText('Столиця України?')).toBeVisible();
  await expect(stream.getByText('Столиця України?')).toBeVisible();
  await expect(host.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'locked');
  await pressBuzzer(ann);
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'locked');
  await expect(host.getByText('ТАЄМНЕ-ПОЯСНЕННЯ: столиця з 1934 року.')).toBeVisible();
  for (const page of [ann, bob, stream]) {
    expect(await page.content()).not.toContain('ТАЄМНА-ВІДПОВІДЬ');
    expect(await page.content()).not.toContain('ТАЄМНЕ-ПОЯСНЕННЯ');
  }

  // Open: the first press wins, everyone else is locked and told who answers.
  await host.getByRole('button', { name: 'Відкрити відповіді' }).click();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'ready');
  await pressBuzzer(ann);
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'won');
  await expect(buzzer(bob)).toHaveAttribute('data-state', 'locked');
  await expect(buzzer(bob)).toHaveText('Анна відповідає');
  await expect(stream.getByText('Анна відповідає')).toBeVisible();
  await expect(host.getByText('Анна відповідає')).toBeVisible();

  // Wrong: minus points, the others may press, this player may not.
  await host.getByRole('button', { name: 'Неправильно' }).click();
  await expect(score(ann)).toHaveText('−200');
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'spent');
  await expect(buzzer(bob)).toHaveAttribute('data-state', 'ready');
  // The verdict plays: on the stream for everyone, on the phone of the one who answered.
  await expect(stream.getByText('Анна: неправильно, −200')).toBeAttached();
  await expect(ann.getByText('Цього разу без вас')).toBeVisible();
  await expect(bob.getByText('Цього разу без вас')).toHaveCount(0);
  await expect(buzzer(bob)).toHaveText('Ваш шанс!');

  // Right: plus points, the answer is revealed to everyone, the tile closes.
  await pressBuzzer(bob);
  await host.getByRole('button', { name: 'Правильно', exact: true }).click();
  await expect(score(bob)).toHaveText('200');
  await expect(stream.getByText('Богдан: правильно, +200')).toBeAttached();
  // The change rises from the score in the standings.
  await expect(stream.locator('.vd-leaderboard__change', { hasText: '+200' })).toBeVisible();
  await expect(bob.getByText('Правильно!')).toBeVisible();
  await expect(ann.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
  await expect(stream.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
  await expect(ann.getByText('ТАЄМНЕ-ПОЯСНЕННЯ: столиця з 1934 року.')).toBeVisible();
  await expect(stream.getByText('ТАЄМНЕ-ПОЯСНЕННЯ: столиця з 1934 року.')).toBeVisible();

  await host.getByRole('button', { name: 'До дошки' }).click();
  const played = host.getByRole('group', { name: 'Географія' }).getByRole('button').first();
  await expect(played).toBeDisabled();

  // A player who reloads keeps their place and score.
  await ann.reload();
  await expect(score(ann)).toHaveText('−200');
  await expect(ann.getByText('Ведучий обирає питання')).toBeVisible();

  // Skip: no points. The last tile of the round ends the round.
  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '400' }).click();
  await host.getByRole('button', { name: 'Пропустити' }).click();
  await expect(ann.getByText('Дніпро')).toBeVisible();
  await expect(stream.getByText(': правильно,')).toHaveCount(0);
  await host.getByRole('button', { name: 'До дошки' }).click();
  await expect(ann.getByText('Раунд 1 завершено')).toBeVisible();
  await expect(score(bob)).toHaveText('200');

  // Round 2 has its own board and x3 points.
  await host.getByRole('button', { name: 'Наступний раунд' }).click();
  await host.getByRole('group', { name: 'Наука' }).getByRole('button', { name: '600' }).click();
  await host.getByRole('button', { name: 'Відкрити відповіді' }).click();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'ready');
  await pressBuzzer(ann);
  await host.getByRole('button', { name: 'Правильно', exact: true }).click();
  await expect(score(ann)).toHaveText('400');

  // Manual correction, live for the player.
  await host.getByRole('button', { name: 'Змінити очки: Богдан' }).click();
  await host.getByLabel('На скільки змінити').fill('50');
  await host.getByRole('button', { name: 'Застосувати' }).click();
  await expect(score(bob)).toHaveText('250');

  // The end.
  await host.getByRole('button', { name: 'До дошки' }).click();
  await host.getByRole('button', { name: 'Підбити підсумки' }).click();
  await expect(host.getByText('Перемагає Анна: 400')).toBeVisible();
  await expect(bob.getByText('Перемагає Анна')).toBeVisible();
  await expect(stream.getByText('Перемагає Анна')).toBeVisible();
});

test('a press that comes too late shows by how much', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  const bob = await joinGame(browser, code, 'Богдан');
  const stream = await (await browser.newContext()).newPage();
  await stream.goto(`/stream/${code}`);

  await host.getByRole('button', { name: 'Почати гру' }).click();
  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '200' }).click();
  await host.getByRole('button', { name: 'Відкрити відповіді' }).click();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'ready');
  await expect(buzzer(bob)).toHaveAttribute('data-state', 'ready');

  // Both press at once, before either phone hears who won.
  await Promise.all([pressBuzzer(ann), pressBuzzer(bob)]);
  const stateOf = (page: Page) => buzzer(page).getAttribute('data-state');
  await expect
    .poll(async () => [await stateOf(ann), await stateOf(bob)].includes('won'))
    .toBe(true);
  const winnerIsAnn = (await stateOf(ann)) === 'won';
  const [late, lateName] = winnerIsAnn ? [bob, 'Богдан'] : [ann, 'Анна'];

  await expect(late.getByText('Ви запізнились на').first()).toBeAttached();
  await expect(
    late.getByRole('status').filter({ hasText: /Ви запізнились на \+\d,\d{3} с/ }),
  ).toBeAttached();
  const ladder = stream.getByRole('list', { name: 'Хто натиснув пізніше' });
  await expect(ladder).toContainText(lateName);
  await expect(ladder).toContainText(/\+\d,\d{3} с/);
  await expect(host.getByRole('list', { name: 'Хто натиснув пізніше' })).toContainText(lateName);

  // Judged, the stopwatch and the ladder go.
  await host.getByRole('button', { name: 'Правильно', exact: true }).click();
  await expect(ladder).toBeHidden();
  await expect(late.getByText('Ви запізнились на')).toHaveCount(0);
});

test('a nickname cannot be taken twice and a bad code is explained', async ({ browser }) => {
  const { code } = await hostGame(browser);
  await joinGame(browser, code, 'Анна');

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/join/${code}`);
  await page.getByLabel('Нікнейм').fill('анна');
  await page.getByRole('button', { name: 'Приєднатися' }).click();
  await expect(page.getByRole('alert')).toContainText('нікнейм уже зайнято');

  await page.getByLabel('Код кімнати').fill('ZZZZZ');
  await page.getByLabel('Нікнейм').fill('Олег');
  await page.getByRole('button', { name: 'Приєднатися' }).click();
  await expect(page.getByRole('alert')).toContainText('не знайдено');
});

test('the create button stays level with the input when the error appears', async ({ page }) => {
  await page.goto('/quizzes');
  const input = page.getByLabel('Назва нового квізу');
  const button = page.getByRole('button', { name: 'Створити' });
  const offset = async () => (await button.boundingBox())!.y - (await input.boundingBox())!.y;
  expect(Math.abs(await offset())).toBeLessThan(1);
  await button.click();
  await expect(page.getByText('Вкажіть назву.')).toBeVisible();
  expect(Math.abs(await offset())).toBeLessThan(1);
});

test('AI fills the editor as a draft, one round at a time', async ({ browser }) => {
  const { host } = await hostGame(browser);

  const requests: Record<string, unknown>[] = [];
  await host.route('**/functions/v1/generate-round', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, headers, json: { providers: PROVIDERS } });
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    return route.fulfill({
      status: 200,
      headers,
      json: {
        provider: body.provider === 'auto' ? 'gemini' : body.provider,
        categories: Array.from({ length: body.categories }, (_, c) => ({
          title: `AI раунд ${body.round} категорія ${c + 1}`,
          questions: Array.from({ length: body.questions }, (_, q) => ({
            text: `Питання ${q + 1}`,
            answer: `Відповідь ${q + 1}`,
            // One photo that arrives and one that does not.
            ...(body.images && q === 0 && c < 2
              ? { imageUrl: `https://upload.wikimedia.org/test/${c === 0 ? 'photo' : 'gone'}.png` }
              : {}),
          })),
        })),
      },
    });
  });
  await host.route('https://upload.wikimedia.org/**', (route) =>
    route.request().url().endsWith('photo.png')
      ? route.fulfill({
          path: 'public/icons/icon-192.png',
          headers: { 'access-control-allow-origin': '*' },
        })
      : route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' } }),
  );
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();

  // Only the AIs with keys are offered, and the choice is sent with every round.
  await host.getByRole('combobox', { name: 'Хто пише питання' }).click();
  const options = host.getByRole('option');
  await expect(options).toHaveText(['Авто', 'Gemini', 'Groq']);
  await options.filter({ hasText: 'Groq' }).click();
  // A brief over 1500 characters is counted, explained and not sent.
  await host.getByLabel('Тема квізу').fill('к'.repeat(1501));
  await host.getByRole('button', { name: 'Згенерувати' }).click();
  await expect(host.getByText('Перевищення на 1')).toBeVisible();
  expect(requests).toHaveLength(0);
  await host.getByLabel('Тема квізу').fill('Кіно 90-х');
  await host.getByRole('checkbox', { name: 'Додати фото до відповідей' }).check();
  await host.getByRole('button', { name: 'Згенерувати' }).click();
  // The quiz already has questions, so replacing them needs a yes.
  await host.getByRole('alertdialog').getByRole('button', { name: 'Замінити' }).click();

  await expect(host.getByRole('textbox', { name: 'Категорія 1', exact: true })).toHaveValue(
    'AI раунд 1 категорія 1',
  );
  await host.getByRole('tab', { name: 'Раунд 2' }).click();
  await expect(host.getByRole('textbox', { name: 'Категорія 1', exact: true })).toHaveValue(
    'AI раунд 2 категорія 1',
  );
  expect(requests.map((r) => r['round'])).toEqual([1, 2]);
  expect(requests[1]!['avoid']).toEqual(['AI раунд 1 категорія 1']);
  expect(requests[0]!['prompt']).toBe('Кіно 90-х');
  expect(requests.map((r) => r['provider'])).toEqual(['groq', 'groq']);
  expect(requests.map((r) => r['images'])).toEqual([true, true]);
  // Round 2 knows round 1's answers, so it cannot ask the same things again.
  expect(requests[0]!['avoidAnswers']).toEqual([]);
  expect(requests[1]!['avoidAnswers']).toContain('Відповідь 1');
  // The photo goes with the answer, never ahead of it; the one that failed leaves none.
  const panel = host.getByRole('tabpanel');
  await expect(panel.locator('img[src*="quiz-media"]')).toHaveCount(1);
  // Folded questions are outside the accessibility tree, so the pictures are found by their text.
  await expect(panel.locator('img[alt="Картинка до відповіді"]')).toHaveCount(1);
  await expect(panel.locator('img[alt="Картинка до питання"]')).toHaveCount(0);
  await expect(host.getByText('Писав Groq.', { exact: false })).toBeVisible();

  // A draft: nothing is stored until the host saves it.
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeEnabled();
});

test('AI edits one question or a category, and the toast takes it back', async ({ browser }) => {
  const { host } = await hostGame(browser);
  const requests: Record<string, unknown>[] = [];
  await host.route('**/functions/v1/generate-round', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, headers, json: { providers: PROVIDERS } });
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    type Current = { title: string; questions: { text: string; answer: string }[] }[];
    return route.fulfill({
      status: 200,
      headers,
      json: {
        provider: 'groq',
        categories: (body.current as Current).map((category) => ({
          title: `AI ${category.title}`,
          questions: category.questions.map((question) => ({
            text: `AI: ${question.text}`,
            answer: question.answer,
            explanation: 'Пояснення від AI.',
          })),
        })),
      },
    });
  });
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();

  // One question: a quick option fills in the request, which carries just that question.
  await host.locator('summary').filter({ hasText: 'Найдовша річка України?' }).click();
  await host.getByRole('button', { name: 'Змінити питання з AI' }).click();
  const panel = host.getByRole('dialog', { name: 'Змінити питання' });
  await expect(panel).toContainText('«Географія» · 400 очок');
  await panel.getByRole('button', { name: 'Пояснення' }).click();
  await expect(panel.getByLabel('Що змінити')).toHaveValue('Додай коротке пояснення відповіді.');
  await panel.getByRole('button', { name: 'Змінити', exact: true }).click();

  const open = host.locator('details[open]');
  const question = open.getByRole('textbox', { name: 'Питання', exact: true });
  await expect(question).toHaveValue('AI: Найдовша річка України?');
  await expect(open.getByLabel('Пояснення відповіді')).toHaveValue('Пояснення від AI.');
  expect(requests[0]).toMatchObject({
    prompt: 'Додай коротке пояснення відповіді.',
    categories: 1,
    questions: 1,
    current: [
      {
        title: 'Географія',
        questions: [{ text: 'Найдовша річка України?', answer: 'Дніпро', explanation: '' }],
      },
    ],
  });
  // The category keeps its name and the other question stays as it was.
  const title = host.getByRole('textbox', { name: 'Категорія 1', exact: true });
  await expect(title).toHaveValue('Географія');
  await expect(host.locator('summary').first()).toContainText('Столиця України?');

  await host
    .getByRole('listitem')
    .filter({ hasText: 'Питання змінено' })
    .getByRole('button', { name: 'Скасувати' })
    .click();
  await expect(question).toHaveValue('Найдовша річка України?');

  // A whole category, typed by hand.
  await host.getByRole('button', { name: 'Змінити категорію з AI' }).first().click();
  const category = host.getByRole('dialog', { name: 'Змінити категорію' });
  await category.getByLabel('Що змінити').fill('Тільки про річки');
  await category.getByRole('button', { name: 'Змінити', exact: true }).click();
  await expect(title).toHaveValue('AI Географія');
  await expect(question).toHaveValue('AI: Найдовша річка України?');
  expect(requests[1]).toMatchObject({ prompt: 'Тільки про річки', categories: 1, questions: 2 });
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeEnabled();
});

test('a host connects their own AI by key and it writes the quiz', async ({ browser }) => {
  const { host } = await hostGame(browser);
  const requests: Record<string, unknown>[] = [];
  await host.route('**/functions/v1/generate-round', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, headers, json: { providers: PROVIDERS } });
    }
    const body = route.request().postDataJSON();
    if (body.action === 'models') {
      return body.key === 'sk-good-key-123'
        ? route.fulfill({
            status: 200,
            headers,
            json: { models: [{ id: 'gpt-test', label: 'GPT Test' }] },
          })
        : route.fulfill({ status: 400, headers, json: { code: 'ai_key_invalid' } });
    }
    requests.push(body);
    return route.fulfill({
      status: 200,
      headers,
      json: {
        provider: 'own:0',
        categories: Array.from({ length: body.categories }, (_, c) => ({
          title: `Свій AI ${body.round}.${c + 1}`,
          questions: Array.from({ length: body.questions }, (_, q) => ({
            text: `Питання ${q + 1}`,
            answer: `Відповідь ${body.round}.${c + 1}.${q + 1}`,
            explanation: body.explain ? 'Цікавинка.' : '',
          })),
        })),
      },
    });
  });
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();

  await host.getByRole('button', { name: 'Свої нейронки' }).click();
  const dialog = host.getByRole('dialog', { name: 'Свої нейронки' });
  // Free on the host's own key, Gemini is offered first; this host brings ChatGPT.
  await expect(dialog.getByRole('combobox', { name: 'Компанія' })).toHaveText(/Gemini/);
  await dialog.getByRole('combobox', { name: 'Компанія' }).click();
  await host.getByRole('option', { name: 'ChatGPT (OpenAI)' }).click();
  const key = dialog.getByLabel('API-ключ');
  await key.fill('sk-wrong-key');
  await dialog.getByRole('button', { name: 'Перевірити ключ' }).click();
  await expect(dialog.getByText('Провайдер не прийняв ключ')).toBeVisible();

  await key.fill('sk-good-key-123');
  await dialog.getByRole('button', { name: 'Перевірити ключ' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Модель' })).toHaveValue('GPT Test');
  await dialog.getByRole('button', { name: 'Додати' }).click();
  await expect(dialog).toBeHidden();
  await expect(host.getByRole('combobox', { name: 'Хто пише питання' })).toHaveText(
    /ChatGPT · GPT Test/,
  );

  await host.getByLabel('Тема квізу').fill('Історія науки');
  await host.getByRole('checkbox', { name: 'Писати пояснення до відповідей' }).check();
  await host.getByRole('button', { name: 'Згенерувати' }).click();
  await host.getByRole('alertdialog').getByRole('button', { name: 'Замінити' }).click();
  await expect(host.getByText('Писав ChatGPT · GPT Test.', { exact: false })).toBeVisible();
  // The key goes with the request for the chosen AI only, and is kept nowhere but this browser.
  expect(requests[0]).toMatchObject({
    provider: 'own',
    explain: true,
    own: [{ vendor: 'openai', key: 'sk-good-key-123', model: 'gpt-test' }],
  });

  // Removing it brings the free AIs back.
  await host.getByRole('button', { name: 'Свої нейронки' }).click();
  await dialog.getByRole('button', { name: 'Прибрати ChatGPT GPT Test' }).click();
  await expect(dialog.getByRole('list', { name: 'Підключені нейронки' })).toBeHidden();
  await host.keyboard.press('Escape');
  await expect(host.getByRole('combobox', { name: 'Хто пише питання' })).toHaveText(/Авто/);
});

test('an interrupted generation continues from the failed round', async ({ browser }) => {
  const { host } = await hostGame(browser);
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();

  const rounds: number[] = [];
  let busy = true;
  await host.route('**/functions/v1/generate-round', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, headers, json: { providers: PROVIDERS } });
    }
    const body = route.request().postDataJSON();
    rounds.push(body.round);
    if (body.round === 2 && busy) {
      busy = false;
      return route.fulfill({ status: 503, headers, json: { code: 'ai_busy' } });
    }
    return route.fulfill({
      status: 200,
      headers,
      json: {
        provider: 'gemini',
        categories: Array.from({ length: body.categories }, (_, c) => ({
          title: `Раунд ${body.round} категорія ${c + 1}`,
          questions: Array.from({ length: body.questions }, (_, q) => ({
            text: `Питання ${q + 1}`,
            answer: `Відповідь ${q + 1}`,
          })),
        })),
      },
    });
  });

  await host.getByLabel('Тема квізу').fill('Кіно');
  await host.getByRole('button', { name: 'Згенерувати' }).click();
  await host.getByRole('alertdialog').getByRole('button', { name: 'Замінити' }).click();
  await expect(host.getByText('AI зараз перевантажений')).toBeVisible();

  // Round 1 stays, and only round 2 is requested again, without a second question.
  await host.getByRole('button', { name: 'Продовжити з раунду 2' }).click();
  await expect(host.getByText('Квіз написано')).toBeVisible();
  expect(rounds).toEqual([1, 2, 2]);
  await expect(host.getByRole('button', { name: 'Згенерувати' })).toBeVisible();
});

test('a used-up AI limit is explained and leaves the quiz as it was', async ({ browser }) => {
  const { host } = await hostGame(browser);
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();
  await host.route('**/functions/v1/generate-round', (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 200 : 429,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      json: { code: 'ai_limit' },
    }),
  );
  await host.getByLabel('Тема квізу').fill('Кіно');
  await host.getByRole('button', { name: 'Згенерувати' }).click();
  await host.getByRole('alertdialog').getByRole('button', { name: 'Замінити' }).click();
  await expect(host.getByText('Ліміт AI на сьогодні вичерпано')).toBeVisible();
  await expect(host.getByRole('textbox', { name: 'Категорія 1', exact: true })).toHaveValue(
    'Географія',
  );
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();
});

test('only the device that created the game gets the controls', async ({ browser }) => {
  const { code } = await hostGame(browser);
  const context = await browser.newContext();
  const stranger = await context.newPage();
  await stranger.goto(`/host/${code}`);
  await expect(stranger.getByText('Ви не ведучий цієї гри')).toBeVisible();
  await expect(stranger.getByRole('button', { name: 'Почати гру' })).toHaveCount(0);
});

test('an uploaded picture is compressed and reaches the players', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  await host.getByRole('button', { name: 'Почати гру' }).click();
  await expect(ann.getByText('Ведучий обирає питання')).toBeVisible();

  // Editing the quiz does not disturb the running room: upload into the quiz, then start another.
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();
  await host.getByRole('tab', { name: 'Раунд 2' }).click();
  await host.getByText('600 ·').click();
  const png = await host.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = 1500;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff00ff';
    context.fillRect(0, 0, 3000, 1500);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await host
    .locator('details[open]')
    .getByLabel('Картинка до питання')
    .setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  const image = host.locator('details[open]').getByRole('img', { name: 'Картинка до питання' });
  await expect(image).toBeVisible();
  const src = (await image.getAttribute('src'))!;
  expect(src).toMatch(/\/quiz-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
  const size = await image.evaluate((el: HTMLImageElement) => el.naturalWidth);
  expect(size).toBe(1280);

  await host.getByRole('button', { name: 'Зберегти' }).click();
  await expect(host.getByText('Квіз збережено').last()).toBeVisible();
});

for (const [name, path] of [
  ['join', '/join'],
  ['quizzes', '/quizzes'],
] as const) {
  test(`axe: ${name} page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

test('axe: host, player and stream during a question', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  const context = await browser.newContext();
  const stream = await context.newPage();
  await stream.goto(`/stream/${code}`);
  await expect(stream.getByText(code, { exact: true }).first()).toBeVisible();

  for (const page of [host, ann, stream]) {
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  await host.getByRole('button', { name: 'Почати гру' }).click();
  await expect(ann.getByText('Ведучий обирає питання')).toBeVisible();
  await expect(host.getByRole('group', { name: 'Географія' })).toBeVisible();
  for (const page of [host, ann, stream]) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '200' }).click();
  await host.getByRole('button', { name: 'Відкрити відповіді' }).click();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'ready');
  for (const page of [host, ann, stream]) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('a host who reloads during a question still sees the answer', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  await joinGame(browser, code, 'Анна');
  await host.getByRole('button', { name: 'Почати гру' }).click();
  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '200' }).click();
  await expect(host.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
  await host.reload();
  await expect(host.getByText('Столиця України?')).toBeVisible();
  await expect(host.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
});

test('a phone fits the buzzer in every state, without sideways scrolling', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  const noOverflow = () =>
    ann.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

  await host.getByRole('button', { name: 'Почати гру' }).click();
  await host.getByRole('group', { name: 'Географія' }).getByRole('button', { name: '200' }).click();
  await expect(buzzer(ann)).toBeInViewport({ ratio: 1 });
  expect(await noOverflow()).toBe(true);

  await host.getByRole('button', { name: 'Відкрити відповіді' }).click();
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'ready');
  expect(await noOverflow()).toBe(true);

  await pressBuzzer(ann);
  await expect(buzzer(ann)).toHaveAttribute('data-state', 'won');
  await expect(buzzer(ann)).toBeInViewport({ ratio: 1 });
  expect(await noOverflow()).toBe(true);
});

test('headers stay tidy on a phone, with a very long title', async ({ browser }) => {
  const longTitle = JSON.stringify({
    ...JSON.parse(QUIZ_JSON),
    title: 'Дуже довга назва квізу, яка точно не вміщується в один рядок телефона',
  });
  const { host, code } = await hostGame(browser, longTitle);
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const stream = await context.newPage();
  await stream.goto(`/stream/${code}`);
  for (const page of [host, stream]) {
    await page.setViewportSize({ width: 390, height: 800 });
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();
    expect((await title.boundingBox())!.height).toBeLessThan(40);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test('the app describes itself for installing, and offers the browser dialog', async ({ page }) => {
  await page.goto('/join');
  const manifestUrl = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await page.request.get(`/${manifestUrl}`)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
  for (const icon of manifest.icons) {
    expect((await page.request.get(`/${icon.src}`)).headers()['content-type']).toContain(
      'image/png',
    );
  }

  const install = page.getByRole('button', { name: 'Встановити застосунок' });
  await expect(install).toHaveCount(0);
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await install.click();
  await expect(install).toHaveCount(0);
});

test('the menu leads between pages and marks the current one', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Головне меню' });
  await expect(menu.getByRole('link', { name: 'Увійти в гру' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await menu.getByRole('link', { name: 'Мої квізи' }).click();
  await expect(page.getByRole('heading', { name: 'Мої квізи' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Мої квізи' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(menu.getByRole('link', { name: 'Увійти в гру' })).not.toHaveAttribute(
    'aria-current',
  );

  await menu.getByRole('link', { name: 'Vadem, на головну' }).click();
  await expect(page.getByRole('heading', { name: 'Квіз із друзями' })).toBeVisible();
});

test('a phone shows the menu without sideways scrolling or a second scroll', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const page = await context.newPage();
  for (const path of ['/join', '/quizzes']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Головне меню' })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits, path).toBe(true);
  }
});

test('leaving the editor with unsaved changes asks first', async ({ browser }) => {
  const { host } = await hostGame(browser);
  await host.goto('/quizzes');
  await host.getByRole('link', { name: 'Редагувати' }).first().click();
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();
  await host.getByLabel('Назва квізу').fill('Нова назва');

  const menuLink = host.getByRole('navigation').getByRole('link', { name: 'Мої квізи' });
  host.once('dialog', (dialog) => dialog.dismiss());
  await menuLink.click();
  await expect(host.getByLabel('Назва квізу')).toHaveValue('Нова назва');

  host.once('dialog', (dialog) => dialog.accept());
  await menuLink.click();
  await expect(host.getByRole('heading', { name: 'Мої квізи' })).toBeVisible();
});

test('game screens have a way out and a player can come back', async ({ browser }) => {
  const { host, code } = await hostGame(browser);
  const ann = await joinGame(browser, code, 'Анна');
  await expect(ann.getByRole('navigation', { name: 'Головне меню' })).toHaveCount(0);

  await ann.getByRole('link', { name: 'Вийти з гри' }).click();
  await ann.getByRole('link', { name: `Повернутися до гри ${code}` }).click();
  await expect(ann.getByRole('heading', { name: `Ви в кімнаті ${code}` })).toBeVisible();

  await host.getByRole('link', { name: 'До моїх квізів' }).click();
  await expect(host.getByRole('heading', { name: 'Мої квізи' })).toBeVisible();

  const context = await browser.newContext();
  const stream = await context.newPage();
  await stream.goto(`/stream/${code}`);
  await expect(stream.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(stream.getByRole('link')).toHaveCount(0);
});

test('the join page fits a phone and offers the form on the first screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await context.newPage();
  await page.goto('/join');
  await expect(page.getByLabel('Код кімнати')).toBeInViewport();
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(fits).toBe(true);
});
