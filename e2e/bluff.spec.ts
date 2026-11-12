import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
