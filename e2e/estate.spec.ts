import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { joinGame } from './helpers';
import { hostPage, openRoom, rpc, type OpenRoom } from './rooms';

test('a "Господар" quiz starts as a ready board and keeps its own names', async ({ page }) => {
  await page.goto('/quizzes');
  await page.getByRole('button', { name: /^Господар/ }).click();
  await page.getByRole('dialog').getByLabel('Назва квізу').fill('Мапа');
  await page.getByRole('button', { name: 'Створити' }).click();
  await expect(page.getByText('Заповнено 56 з 56')).toBeVisible();
  await expect(page.getByLabel('Регіон 8')).toHaveValue('Київщина');

  const kyiv = page.getByLabel('Місто · 4000 ₴');
  await kyiv.fill('');
  await expect(page.getByText('Заповнено 55 з 56')).toBeVisible();
  await kyiv.fill('Столиця');

  await page.getByRole('radio', { name: 'Хвилини' }).click();
  await expect(page.getByLabel('Скільки хвилин')).toHaveValue('60');
  await page.getByRole('switch', { name: 'Обмежити час на кожен крок ходу' }).uncheck();
  await page.getByRole('button', { name: 'Видалити картку 1' }).first().click();

  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await axe.analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByText('Квіз збережено')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Місто · 4000 ₴')).toHaveValue('Столиця');
  await expect(page.getByLabel('Скільки хвилин')).toHaveValue('60');
  await expect(page.getByText('Без таймера: гравці ходять у своєму темпі.')).toBeVisible();
  await expect(page.getByText('Заповнено 55 з 55')).toBeVisible();
});

function estateRoom(): Promise<OpenRoom> {
  const card = (text: string) => ({ text, effect: { kind: 'money', amount: 100 } });
  return openRoom({
    title: 'Тест Господаря',
    mode: 'estate',
    regions: Array.from({ length: 8 }, (_, i) => `Регіон ${i + 1}`),
    cells: Array.from({ length: 32 }, (_, i) => `Клітина ${i}`),
    fate: [card('Доля дає')],
    community: [card('Громада дає')],
    startMoney: 15000,
    endKind: 'laps',
    endValue: 10,
    turnSeconds: null,
  } as { title: string });
}

/** Takes whatever turn action this phone offers: always buying, never letting land go. */
async function act(page: Page): Promise<boolean> {
  for (const name of [/^Купити ·/, /^Кинути кубики$|Кидайте ще/, /^Завершити хід$/, /^Сплатити$/]) {
    const button = page.getByRole('button', { name });
    if ((await button.isVisible()) && (await button.isEnabled())) {
      await button.click();
      await expect(button)
        .toBeHidden()
        .catch(() => undefined);
      return true;
    }
  }
  return false;
}

/** Plays turns until the condition holds. */
async function playUntil(players: Page[], done: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 80 && !(await done()); i += 1) {
    let moved = false;
    for (const page of players) moved = (await act(page)) || moved;
    if (!moved) await players[0]!.waitForTimeout(200);
  }
  expect(await done()).toBe(true);
}

test('a game of "Господар" from the phones, the host page and the stream', async ({ browser }) => {
  const room = await estateRoom();
  const host = await hostPage(browser, room);
  await host.goto(`/host/${room.code}`);
  const ann = await joinGame(browser, room.code, 'Ann');
  const bob = await joinGame(browser, room.code, 'Bob');
  await host.getByRole('button', { name: 'Почати гру' }).click();

  await expect(ann.getByText('Ваш хід')).toBeVisible();
  await expect(bob.getByText('Ходить Ann').first()).toBeVisible();
  await expect(host.getByRole('group', { name: 'Поле гри' })).toBeVisible();

  // Ann buys the first free land she stops on.
  const annOwns = () =>
    ann
      .getByRole('button', { name: /Власник: Ann/ })
      .first()
      .isVisible();
  await playUntil([ann, bob], annOwns);
  await expect(host.getByRole('button', { name: /Власник: Ann/ }).first()).toBeVisible();

  const axe = new AxeBuilder({ page: ann }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await axe.analyze()).violations).toEqual([]);

  await ann.getByRole('tab', { name: 'Майно' }).click();
  const land = ann.getByRole('tabpanel').locator('.link').first();
  const landName = (await land.textContent())!.trim();

  // Ann sells it to Bob for 100.
  await ann.getByRole('tab', { name: /Обмін/ }).click();
  await ann.getByRole('combobox', { name: 'З ким' }).click();
  await ann.getByRole('option', { name: 'Bob' }).click();
  await ann.getByRole('checkbox', { name: landName }).check();
  await ann.getByLabel('Просите доплату, ₴').fill('100');
  await ann.getByLabel('Просите доплату, ₴').blur();
  await ann.getByRole('button', { name: 'Запропонувати' }).click();
  await expect(ann.getByText('Чекаємо на відповідь.')).toBeVisible();

  await bob.getByRole('tab', { name: /Обмін/ }).click();
  await expect(bob.getByRole('heading', { name: 'Ann пропонує угоду' })).toBeVisible();
  await bob.getByRole('button', { name: 'Прийняти' }).click();
  await expect(
    host.getByRole('button', { name: new RegExp(`^${landName}\\b.*Власник: Bob`) }),
  ).toBeVisible();

  const stream = await host.context().newPage();
  await stream.goto(`/stream/${room.code}`);
  await expect(stream.getByRole('group', { name: 'Поле гри' })).toBeVisible();
  await expect(stream.getByText(/Ann і Bob уклали угоду/)).toBeVisible();

  await rpc('finish_game', { p_room_id: room.roomId, p_token: room.hostToken });
  await expect(ann.getByText(/переможець|Переможець|Перемагає/).first()).toBeVisible();
});
