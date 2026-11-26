import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
