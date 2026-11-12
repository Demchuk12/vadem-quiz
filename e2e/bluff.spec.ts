import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('a "Варіанти" quiz is made of facts with a truth and a decoy', async ({ page }) => {
  await page.goto('/quizzes');
  await page.getByRole('radio', { name: 'Варіанти' }).check();
  await page.getByLabel('Назва нового квізу').fill('Дивні факти');
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
