import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { joinGame, localSupabase } from './helpers';

test('a "Варіанти" quiz is made of facts with a truth and a decoy', async ({ page }) => {
  await page.goto('/quizzes');
  await page.getByRole('button', { name: /^Варіанти/ }).click();
  await page.getByRole('dialog').getByLabel('Назва квізу').fill('Дивні факти');
  await page.getByRole('button', { name: 'Створити' }).click();

  await expect(page.getByLabel('Факт без закінчення')).toHaveCount(10);
  await expect(page.getByText('Заповнено 0 з 10')).toBeVisible();
  await expect(page.getByRole('button', { name: /AI/ })).toHaveCount(0);

  await page.getByLabel('Факт без закінчення').first().fill('У Швеції є готель, збудований з');
  await page.getByLabel('Правдиве закінчення').first().fill('льоду');
  await page.getByLabel('Пастка ведучого').first().fill('соломи');
  await page.getByRole('button', { name: 'Видалити факт 10' }).click();
  await page.getByRole('button', { name: 'Додати факт' }).click();
  await page.getByRole('button', { name: 'Додати факт' }).click();
  await expect(page.getByText('Заповнено 1 з 11')).toBeVisible();

  // WCAG rules only: the editor page, of either game, has no level-one heading yet.
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await axe.analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByText('Квіз збережено')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Правдиве закінчення').first()).toHaveValue('льоду');
  await expect(page.getByLabel('Факт без закінчення')).toHaveCount(11);

  await page.goto('/quizzes');
  const card = page.getByRole('listitem').filter({ hasText: 'Дивні факти' });
  await expect(card.getByText('Варіанти')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Нова гра' })).toHaveCount(0);
});

test('AI writes the facts with decoys, and the host swaps in another', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/generate-round', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        headers,
        json: { providers: [{ id: 'gemini', label: 'Gemini' }] },
      });
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    return route.fulfill({
      status: 200,
      headers,
      json: {
        provider: 'gemini',
        categories: [
          {
            title: 'Факти',
            questions: Array.from({ length: body.questions }, (_, i) => ({
              text: `Факт ${i + 1}…`,
              answer: `правда ${i + 1}`,
              decoys: [`пастка ${i + 1}`, `друга ${i + 1}`, `третя ${i + 1}`],
              explanation: `Пояснення ${i + 1}`,
            })),
          },
        ],
      },
    });
  });

  await page.goto('/quizzes');
  await page.getByRole('button', { name: /^Варіанти/ }).click();
  await page.getByRole('dialog').getByLabel('Назва квізу').fill('AI факти');
  await page.getByRole('button', { name: 'Створити' }).click();

  await page.getByLabel('Тема фактів').fill('тварини');
  await page.getByRole('button', { name: 'Згенерувати 10 фактів' }).click();
  await expect(page.getByText('Заповнено 10 з 10')).toBeVisible();
  expect(requests[0]).toMatchObject({ mode: 'bluff', categories: 1, questions: 10 });

  await expect(page.getByLabel('Пастка ведучого').first()).toHaveValue('пастка 1');
  const ideas = page.getByRole('group', { name: 'Інші пастки для факту 1', exact: true });
  await ideas.getByRole('button', { name: 'третя 1' }).click();
  await expect(page.getByLabel('Пастка ведучого').first()).toHaveValue('третя 1');
  await expect(ideas.getByRole('button', { name: 'пастка 1' })).toBeVisible();

  // Writing again over filled facts asks first.
  await page.getByRole('button', { name: 'Згенерувати 10 фактів' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Замінити факти?' })).toBeVisible();
});

/** Calls a database function as any client would, with the public key. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, anonKey } = localSupabase();
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`${fn}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** A "Варіанти" room with five facts, its first: "готель з… льоду", decoy "соломи". */
async function bluffRoom(): Promise<{ roomId: string; code: string; hostToken: string }> {
  const [quiz] = await rpc<{ quiz_id: string; owner_token: string }[]>('create_quiz', {
    p_title: 'Тест варіантів',
  });
  const facts = Array.from({ length: 5 }, (_, i) =>
    i === 0
      ? { text: 'У Швеції є готель, збудований з…', truth: 'льоду', decoy: 'соломи' }
      : { text: `Факт ${i + 1}…`, truth: `правда ${i + 1}`, decoy: `пастка ${i + 1}` },
  );
  await rpc('save_quiz', {
    p_quiz_id: quiz!.quiz_id,
    p_token: quiz!.owner_token,
    p_document: { title: 'Тест варіантів', mode: 'bluff', facts },
  });
  const [room] = await rpc<{ room_id: string; room_code: string; host_token: string }[]>(
    'create_room',
    { p_quiz_id: quiz!.quiz_id, p_quiz_token: quiz!.owner_token },
  );
  return { roomId: room!.room_id, code: room!.room_code, hostToken: room!.host_token };
}

test('players write lies, vote, and see what the round brought them', async ({ browser }) => {
  const { roomId, code, hostToken } = await bluffRoom();
  const ann = await joinGame(browser, code, 'Ann');
  const bob = await joinGame(browser, code, 'Bob');
  const cat = await joinGame(browser, code, 'Cat');
  await rpc('start_game', { p_room_id: roomId, p_token: hostToken });

  await expect(ann.getByText('У Швеції є готель, збудований з')).toBeVisible();
  await expect(ann.getByRole('timer')).toBeVisible();
  expect((await new AxeBuilder({ page: ann }).analyze()).violations).toEqual([]);

  const write = async (page: Page, text: string) => {
    await page.getByLabel('Ваш варіант').fill(text);
    await page.getByRole('button', { name: 'Надіслати' }).click();
    await expect(page.getByText(`Надіслано: «${text}»`)).toBeVisible();
  };
  await write(ann, 'старих трамваїв');
  await expect(bob.getByText('Написали 1 з 3')).toBeVisible();
  await write(bob, 'пивних бочок');
  // Cat writes the truth: it stands beside it, and Cat may vote for neither.
  await write(cat, 'Льоду');

  const options = (page: Page) => page.getByRole('group', { name: 'Варіанти' }).getByRole('button');
  await expect(options(ann)).toHaveCount(4);
  // The order is random, so the options are compared as a set.
  expect((await options(cat).allInnerTexts()).map((t) => t.trim()).sort()).toEqual(
    ['пивних бочок', 'соломи', 'старих трамваїв'].sort(),
  );
  expect((await new AxeBuilder({ page: bob }).analyze()).violations).toEqual([]);

  await options(bob).filter({ hasText: 'старих трамваїв' }).click();
  await options(cat).filter({ hasText: 'соломи' }).click();
  await expect(ann.getByText('Проголосували 2 з 3')).toBeVisible();
  await options(ann).filter({ hasText: 'пивних бочок' }).click();

  await expect(ann.getByText('Ви повелися на варіант гравця Bob')).toBeVisible();
  await expect(ann.getByText('На ваш варіант повелися: Bob (+1)')).toBeVisible();
  await expect(bob.getByText('На ваш варіант повелися: Ann (+1)')).toBeVisible();
  await expect(cat.getByText('Ви повелися на пастку ведучого: −1')).toBeVisible();
  await expect(cat.getByText('льоду', { exact: true })).toBeVisible();
});
