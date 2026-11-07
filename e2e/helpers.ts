import { devices, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HostedGame {
  host: Page;
  code: string;
}

/** A small quiz: one category with two questions in round 1, one in round 2 (x3). */
export const QUIZ_JSON = JSON.stringify({
  title: 'Тестовий квіз',
  roundMultipliers: [1, 3],
  rounds: [
    {
      categories: [
        {
          title: 'Географія',
          questions: [
            {
              basePoints: 200,
              text: 'Столиця України?',
              answerText: 'ТАЄМНА-ВІДПОВІДЬ-КИЇВ',
              explanation: 'ТАЄМНЕ-ПОЯСНЕННЯ: столиця з 1934 року.',
            },
            { basePoints: 400, text: 'Найдовша річка України?', answerText: 'Дніпро' },
          ],
        },
      ],
    },
    {
      categories: [
        {
          title: 'Наука',
          questions: [{ basePoints: 200, text: 'Хімічна формула води?', answerText: 'H2O' }],
        },
      ],
    },
  ],
});

/** Creates a quiz through the UI, imports the JSON, and opens a room. */
export async function hostGame(browser: Browser, quizJson = QUIZ_JSON): Promise<HostedGame> {
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto('/quizzes');
  await host.getByLabel('Назва нового квізу').fill('Тестовий квіз');
  await host.getByRole('button', { name: 'Створити' }).click();
  await expect(host.getByRole('button', { name: 'Зберегти' })).toBeVisible();

  await host.getByLabel('Імпорт квізу з JSON').setInputFiles({
    name: 'quiz.json',
    mimeType: 'application/json',
    buffer: Buffer.from(quizJson),
  });
  await expect(host.getByText('Заповнено 3 з 3')).toBeVisible();
  await host.getByRole('button', { name: 'Зберегти' }).click();
  // Not the button's state: it also counts as disabled while the request is still in flight.
  await expect(host.getByText('Квіз збережено')).toBeVisible();

  await host.getByRole('link', { name: 'Мої квізи' }).click();
  await host.getByRole('button', { name: 'Нова гра' }).first().click();
  await host.waitForURL(/\/host\/[A-Z0-9]{5}$/);
  await expect(host.getByRole('button', { name: 'Почати гру' })).toBeVisible();
  const code = host.url().split('/').pop()!;
  return { host, code };
}

export async function joinGame(browser: Browser, code: string, nickname: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const player = await context.newPage();
  await player.goto(`/join/${code}`);
  await player.getByLabel('Нікнейм').fill(nickname);
  await player.getByRole('button', { name: 'Приєднатися' }).click();
  await player.waitForURL(`/play/${code}`);
  await expect(player.getByRole('heading', { name: `Ви в кімнаті ${code}` })).toBeVisible();
  return player;
}

export function localSupabase(): { url: string; anonKey: string } {
  const source = readFileSync(join(process.cwd(), 'src/environments/environment.ts'), 'utf8');
  return {
    url: /supabaseUrl:\s*'([^']+)'/.exec(source)![1]!,
    anonKey: /supabaseAnonKey:\s*'([^']+)'/.exec(source)![1]!,
  };
}
