import AxeBuilder from '@axe-core/playwright';
import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { bluffRoom, rpc } from './bluff-room';

const ENGLISH_BOARD = {
  title: 'Test quiz',
  roundMultipliers: [1],
  rounds: [
    {
      categories: [
        {
          title: 'Geography',
          questions: [
            { basePoints: 200, text: 'Capital of France?', answerText: 'Paris' },
            { basePoints: 400, text: 'Longest river?', answerText: 'Nile' },
          ],
        },
      ],
    },
  ],
};
const ENGLISH_FACTS = Array.from({ length: 5 }, (_, i) => ({
  text: `In Sweden, hotel ${i} is built of…`,
  truth: `ice ${i}`,
  decoy: `straw ${i}`,
}));

async function context(
  browser: Browser,
  settings: { locale?: string; theme?: string },
  options: Parameters<Browser['newContext']>[0] = {},
): Promise<BrowserContext> {
  const made = await browser.newContext(options);
  await made.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      // Only a fresh browser: a later choice in the test must survive a reload.
      if (!localStorage.getItem(`vq.${key}`))
        localStorage.setItem(`vq.${key}`, JSON.stringify(value));
    }
  }, settings);
  return made;
}

/** Everything a person sees or hears, without the switch, which names each language its own way. */
async function cyrillic(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const texts = (element: Element) => [
      ...[...element.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? ''),
      ...['aria-label', 'placeholder', 'alt', 'title'].map((a) => element.getAttribute(a) ?? ''),
      getComputedStyle(element, '::after').content,
      getComputedStyle(element, '::before').content,
    ];
    for (const element of document.body.querySelectorAll('*')) {
      if (element.closest('vq-app-settings, script, style, noscript')) continue;
      found.push(...texts(element).filter((text) => /[а-яіїєґ]/i.test(text)));
    }
    if (/[а-яіїєґ]/i.test(document.title)) found.push(document.title);
    return found;
  });
}

async function expectNoViolations(page: Page): Promise<void> {
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await axe.analyze()).violations).toEqual([]);
}

/** Runs the check on every screen of the site and of both games. */
async function everyScreen(
  browser: Browser,
  settings: { locale: string; theme: string },
  check: (page: Page) => Promise<void>,
): Promise<void> {
  const site = await context(browser, settings);
  const page = await site.newPage();
  await page.goto('/join');
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeVisible();
  await check(page);
  await page.getByRole('button', { name: 'Language and theme' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
  await check(page);

  for (const [game, document] of [
    ['Quiz Board', ENGLISH_BOARD],
    ['Bluff', { title: 'Test quiz', mode: 'bluff', facts: ENGLISH_FACTS }],
  ] as const) {
    await page.goto('/quizzes');
    await check(page);
    await page.getByRole('button', { name: new RegExp(`^${game}`) }).click();
    await page.getByRole('dialog').getByLabel('Quiz title').fill('Test quiz');
    await check(page);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await page.getByLabel('Import a quiz from JSON').setInputFiles({
      name: 'quiz.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(document)),
    });
    await expect(page.getByText('The quiz is imported, save it')).toBeVisible();
    await check(page);
  }

  const { code: boardCode, roomId, hostToken } = await boardRoom();
  const host = await (
    await context(browser, { ...settings, [`host.${boardCode}`]: hostToken } as typeof settings)
  ).newPage();
  await host.goto(`/host/${boardCode}`);
  const stream = await site.newPage();
  await stream.goto(`/stream/${boardCode}`);
  const phone = await joinIn(browser, settings, boardCode, 'Ann');
  const screens = [host, stream, phone];
  const checkAll = async () => {
    for (const screen of screens) await check(screen);
  };
  await expect(host.getByText('Ann', { exact: true })).toBeVisible();
  await checkAll();
  await host.getByRole('button', { name: 'Start the game' }).click();
  await expect(phone.getByText('The host is picking a question.')).toBeVisible();
  await checkAll();
  await host.getByRole('button', { name: '200' }).click();
  await host.getByRole('button', { name: 'Open the buzzers' }).click();
  await expect(phone.locator('button.vd-buzzer')).toHaveText('Answer!');
  await checkAll();
  await phone.locator('button.vd-buzzer').click({ force: true });
  await expect(stream.getByText('Ann is answering')).toBeVisible();
  await checkAll();
  await host.getByRole('button', { name: 'Correct', exact: true }).click();
  await expect(phone.getByText('Paris').first()).toBeVisible();
  await expect(host.getByRole('button', { name: 'Back to the board' })).toBeVisible();
  await expect(phone.locator('.scene')).toHaveCount(0);
  await checkAll();
  await rpc('finish_game', { p_room_id: roomId, p_token: hostToken });
  await expect(stream.getByText('Ann wins: 200')).toBeVisible();
  await checkAll();

  const bluff = await bluffRoom('Test quiz', ENGLISH_FACTS);
  const bluffHost = await (
    await context(browser, {
      ...settings,
      [`host.${bluff.code}`]: bluff.hostToken,
    } as typeof settings)
  ).newPage();
  await bluffHost.goto(`/host/${bluff.code}`);
  const bluffStream = await site.newPage();
  await bluffStream.goto(`/stream/${bluff.code}`);
  const phones: Page[] = [];
  for (const name of ['Ann', 'Bob', 'Cat']) {
    phones.push(await joinIn(browser, settings, bluff.code, name));
  }
  const bluffScreens = [bluffHost, bluffStream, phones[0]!];
  await bluffHost.getByRole('button', { name: 'Start the game' }).click();
  await phones[0]!.getByLabel('Your answer').fill('old trams');
  await phones[0]!.getByRole('button', { name: 'Send' }).click();
  await expect(phones[0]!.getByText('Sent: “old trams”')).toBeVisible();
  for (const screen of bluffScreens) await check(screen);
  await bluffHost.getByRole('button', { name: 'Open the vote' }).click();
  await phones[1]!.getByRole('button', { name: 'old trams' }).click();
  await phones[0]!.getByRole('button', { name: 'ice 0' }).click();
  await expect(bluffStream.getByText('Voted: 2 of 3')).toBeVisible();
  for (const screen of bluffScreens) await check(screen);
  await bluffHost.getByRole('button', { name: 'Reveal the answers' }).click();
  await expect(bluffStream.getByText('Got it right: Ann')).toBeVisible();
  for (const screen of bluffScreens) await check(screen);
}

async function boardRoom() {
  const [quiz] = await rpc<{ quiz_id: string; owner_token: string }[]>('create_quiz', {
    p_title: 'Test quiz',
  });
  await rpc('save_quiz', {
    p_quiz_id: quiz!.quiz_id,
    p_token: quiz!.owner_token,
    p_document: ENGLISH_BOARD,
  });
  const [room] = await rpc<{ room_id: string; room_code: string; host_token: string }[]>(
    'create_room',
    { p_quiz_id: quiz!.quiz_id, p_quiz_token: quiz!.owner_token },
  );
  return { roomId: room!.room_id, code: room!.room_code, hostToken: room!.host_token };
}

async function joinIn(
  browser: Browser,
  settings: { locale: string; theme: string },
  code: string,
  nickname: string,
): Promise<Page> {
  const page = await (await context(browser, settings, { ...devices['Pixel 7'] })).newPage();
  await page.goto(`/join/${code}`);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('heading', { name: `You are in room ${code}` })).toBeVisible();
  return page;
}

test('a first visit speaks the browser’s language, and a choice is remembered', async ({
  browser,
}) => {
  const english = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await english.goto('/join');
  await expect(english.getByRole('heading', { name: 'Join a game' })).toBeVisible();
  await expect(english).toHaveTitle('Quiz with friends');

  await english.getByRole('button', { name: 'Language and theme' }).click();
  await english.getByRole('radio', { name: 'Українська' }).check();
  await expect(english.getByRole('heading', { name: 'Приєднатися до гри' })).toBeVisible();
  await expect(english).toHaveTitle('Квіз із друзями');
  await expect(english.locator('html')).toHaveAttribute('lang', 'uk');
  await english.reload();
  await expect(english.getByRole('heading', { name: 'Приєднатися до гри' })).toBeVisible();
});

test('the theme switches, survives a reload and reaches other tabs', async ({ browser }) => {
  const site = await browser.newContext({ locale: 'uk-UA' });
  const page = await site.newPage();
  const other = await site.newPage();
  await page.goto('/join');
  await other.goto('/quizzes');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Мова і тема' }).click();
  await page.getByRole('radio', { name: 'Світла' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('img', { name: 'Vadem' })).toHaveAttribute('src', /logo-light/);
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'English' }).check();
  await expect(other.getByRole('heading', { name: 'My quizzes' })).toBeVisible();

  // Already light before the app's own code runs.
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body !== null);
  expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe('light');
});

test('no Ukrainian is left on any screen in English', async ({ browser }) => {
  test.slow();
  await everyScreen(browser, { locale: 'en', theme: 'dark' }, async (page) => {
    expect(await cyrillic(page)).toEqual([]);
  });
});

test('axe: every screen in the light theme', async ({ browser }) => {
  test.slow();
  await everyScreen(browser, { locale: 'en', theme: 'light' }, expectNoViolations);
});
