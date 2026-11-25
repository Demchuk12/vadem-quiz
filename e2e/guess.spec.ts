import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { joinGame } from './helpers';
import { hostPage, openRoom, type OpenRoom } from './rooms';

const SECRET = '8848,86';

function guessRoom(patch: Record<string, unknown> = {}): Promise<OpenRoom> {
  return openRoom({
    title: 'Тест чисел',
    mode: 'guess',
    guesses: Array.from({ length: 5 }, (_, i) => ({
      text: `Питання про висоту ${i + 1}`,
      answer: i === 0 ? 8848.86 : (i + 1) * 100,
      unit: i === 0 ? 'м' : '',
      explanation: i === 0 ? 'ТАЄМНЕ-ПОЯСНЕННЯ' : '',
    })),
    ...patch,
  } as { title: string });
}

async function answer(page: Page, text: string): Promise<void> {
  await page.getByLabel('Ваше число').fill(text);
  await page.getByRole('button', { name: /Надіслати|Змінити/ }).click();
}

const rows = (page: Page) =>
  page.getByRole('list', { name: 'Хто наскільки близько' }).getByRole('listitem');
const score = (page: Page) => page.getByLabel('Ваш рахунок');

test('a "На око" quiz is made of questions with numbers', async ({ page }) => {
  await page.goto('/quizzes');
  await page.getByRole('button', { name: /^На око/ }).click();
  await page.getByRole('dialog').getByLabel('Назва квізу').fill('Числа');
  await page.getByRole('button', { name: 'Створити' }).click();
  await expect(page.getByText('Заповнено 0 з 10')).toBeVisible();

  await page.getByLabel('Питання', { exact: true }).first().fill('Висота Евересту?');
  const number = page.getByLabel('Правильне число');
  await number.first().fill('багато');
  await number.first().blur();
  await expect(page.getByText('Введіть число до трильйона')).toBeVisible();
  await expect(page.getByText('Заповнено 0 з 10')).toBeVisible();
  await number.first().fill('12 848,86');
  await number.first().blur();
  await expect(page.getByText('Введіть число до трильйона')).toHaveCount(0);
  await expect(page.getByText('Заповнено 1 з 10')).toBeVisible();
  await page.getByLabel('Одиниці').first().fill('м');

  // A mistake moves up with its question when one above it goes.
  await number.nth(2).fill('ой');
  await number.nth(2).blur();
  await page.getByRole('button', { name: 'Видалити питання 2' }).click();
  await expect(number.nth(1)).toHaveValue('ой');
  await page.getByRole('switch', { name: 'Обмежити час на відповідь' }).uncheck();

  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await axe.analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByText('Квіз збережено')).toBeVisible();
  await page.reload();
  await expect(number).toHaveCount(9);
  await expect(number.first()).toHaveValue(/^12\s848,86$/);
  await expect(page.getByRole('switch', { name: 'Обмежити час на відповідь' })).not.toBeChecked();

  await page.goto('/quizzes');
  const card = page.getByRole('listitem').filter({ hasText: 'Числа' });
  await expect(card.getByText('На око')).toBeVisible();
  await card.getByRole('button', { name: 'Нова гра' }).click();
  await expect(page.getByText('Квіз ще не заповнено')).toBeVisible();
});

test('AI writes the questions with their numbers', async ({ page }) => {
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
            title: 'Питання',
            questions: Array.from({ length: body.questions }, (_, i) => ({
              text: `Скільки ${i}?`,
              answer: String(i * 1000 + 0.5),
              unit: 'шт.',
              explanation: `Бо ${i}`,
            })),
          },
        ],
      },
    });
  });
  await page.goto('/quizzes');
  await page.getByRole('button', { name: /^На око/ }).click();
  await page.getByRole('dialog').getByLabel('Назва квізу').fill('AI числа');
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.getByLabel('Тема питань').fill('рекорди');
  await page.getByRole('button', { name: 'Згенерувати 10 питань' }).click();
  await expect(page.getByText('Заповнено 10 з 10')).toBeVisible();
  expect(requests[0]).toMatchObject({
    mode: 'guess',
    categories: 1,
    questions: 10,
    language: 'uk',
  });
  await expect(page.getByLabel('Правильне число').nth(1)).toHaveValue('1000,5');
  await expect(page.getByLabel('Одиниці').first()).toHaveValue('шт.');
  await page.getByRole('button', { name: 'Згенерувати 10 питань' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Замінити питання?' })).toBeVisible();
});

test('a whole game: closest wins, ties share, the clock ends a round, the final doubles', async ({
  browser,
}) => {
  const room = await guessRoom();
  const host = await hostPage(browser, room);
  await host.clock.install();
  await host.goto(`/host/${room.code}`);
  const stream = await (await browser.newContext()).newPage();
  await stream.goto(`/stream/${room.code}`);
  const start = host.getByRole('button', { name: 'Почати гру' });
  const ann = await joinGame(browser, room.code, 'Ann');
  await expect(start).toBeDisabled();
  await expect(host.getByText('потрібно щонайменше 2 гравці')).toBeVisible();
  const bob = await joinGame(browser, room.code, 'Bob');
  const cat = await joinGame(browser, room.code, 'Cat');
  await start.click();

  // Round 1: the number is the host's alone, until the last answer.
  await expect(host.getByText(`${SECRET} м`)).toBeVisible();
  await expect(stream.getByText('Відповіли 0 з 3')).toBeVisible();
  await expect(stream.getByRole('timer')).toBeVisible();
  await bob.getByLabel('Ваше число').fill('9 000');
  await answer(ann, '8800');
  await expect(ann.getByText('Надіслано: 8800')).toBeVisible();
  // Another player's answer must not wipe what Bob is typing, and a reload keeps Ann's.
  await expect(bob.getByText('Відповіли 1 з 3')).toBeVisible();
  await expect(bob.getByLabel('Ваше число')).toHaveValue('9 000');
  await ann.reload();
  await expect(ann.getByText('Надіслано: 8800')).toBeVisible();
  await answer(ann, SECRET);
  await expect(ann.getByText(`Надіслано: ${SECRET}`)).toBeVisible();
  for (const page of [bob, cat, stream]) {
    expect(await page.content()).not.toContain(SECRET);
    expect(await page.content()).not.toContain('ТАЄМНЕ-ПОЯСНЕННЯ');
  }
  for (const page of [ann, stream, host]) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await bob.getByRole('button', { name: 'Надіслати' }).click();
  await answer(cat, '-5');

  await expect(stream.getByText(`${SECRET} м`).first()).toBeVisible();
  await expect(stream.getByText('ТАЄМНЕ-ПОЯСНЕННЯ')).toBeVisible();
  await expect(rows(stream)).toHaveCount(3);
  await expect(rows(stream).first()).toContainText('Ann');
  await expect(rows(stream).first()).toContainText('Точно в ціль!');
  await expect(rows(stream).nth(1)).toContainText('промах 151,14 м');
  await expect(score(ann)).toHaveText('5');
  await expect(score(bob)).toHaveText('2');
  await expect(score(cat)).toHaveText('1');
  await expect(cat.getByText('3 місце')).toBeVisible();
  for (const page of [ann, stream, host]) {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }

  // Round 2: a tie on both sides of the answer; the clock ends it without Cat.
  await host.getByRole('button', { name: 'Наступне питання' }).click();
  await expect(ann.getByLabel('Ваше число')).toHaveValue('');
  await answer(ann, '190');
  await answer(bob, '210');
  await expect(stream.getByText('Відповіли 2 з 3')).toBeVisible();
  await host.clock.fastForward('00:31');
  await expect(rows(stream)).toHaveCount(2);
  await expect(score(ann)).toHaveText('8');
  await expect(score(bob)).toHaveText('5');
  await expect(cat.getByText('Ви не відповіли')).toBeVisible();

  // Rounds 3 and 4 by the host's hand; nobody answers.
  for (let round = 3; round <= 4; round += 1) {
    await host.getByRole('button', { name: 'Наступне питання' }).click();
    await expect(stream.getByText(`Питання про висоту ${round}`)).toBeVisible();
    await host.getByRole('button', { name: 'Відкрити відповідь' }).click();
    await expect(stream.getByText('Ніхто не відповів')).toBeVisible();
  }

  // The final counts double.
  await host.getByRole('button', { name: 'Наступне питання' }).click();
  await expect(stream.getByText('Фінал: бали ×2')).toBeVisible();
  await expect(cat.getByText('Фінал: бали ×2')).toBeVisible();
  await answer(cat, '500');
  await expect(stream.getByText('Відповіли 1 з 3')).toBeVisible();
  await host.getByRole('button', { name: 'Відкрити відповідь' }).click();
  await expect(score(cat)).toHaveText('11');
  await host.getByRole('button', { name: 'Підбити підсумки' }).click();
  for (const page of [host, stream, ann]) {
    await expect(page.getByText('Перемагає Cat: 11')).toBeVisible();
  }
});

test('without a clock a question waits for the host', async ({ browser }) => {
  const room = await guessRoom({ guessSeconds: null });
  const host = await hostPage(browser, room);
  await host.goto(`/host/${room.code}`);
  const ann = await joinGame(browser, room.code, 'Ann');
  await joinGame(browser, room.code, 'Bob');
  await host.getByRole('button', { name: 'Почати гру' }).click();
  await expect(ann.getByLabel('Ваше число')).toBeVisible();
  await expect(ann.getByRole('timer')).toHaveCount(0);
  await answer(ann, '1');
  await host.getByRole('button', { name: 'Відкрити відповідь' }).click();
  await expect(score(ann)).toHaveText('3');
});
