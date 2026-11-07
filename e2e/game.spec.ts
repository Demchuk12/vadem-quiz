import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { hostGame, joinGame } from './helpers';

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
  for (const page of [ann, bob, stream]) {
    expect(await page.content()).not.toContain('ТАЄМНА-ВІДПОВІДЬ');
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

  // Right: plus points, the answer is revealed to everyone, the tile closes.
  await pressBuzzer(bob);
  await host.getByRole('button', { name: 'Правильно', exact: true }).click();
  await expect(score(bob)).toHaveText('200');
  await expect(ann.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();
  await expect(stream.getByText('ТАЄМНА-ВІДПОВІДЬ-КИЇВ')).toBeVisible();

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
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeDisabled();
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
