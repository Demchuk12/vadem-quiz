// Writes the installed app's icons into public/icons from the logo mark. Run: node tools/pwa-icons.mjs
// Needs a browser: npx playwright install chromium
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The page background: --vd-neutral-975 at the app's accent hue. */
const BACKGROUND = 'oklch(0.165 0.012 158)';
const MARK = readFileSync('public/brand/vadem-mark-dark.svg', 'utf8');

// Maskable icons get cropped to a circle or a squircle, so their mark stays inside the safe zone.
const ICONS = [
  { file: 'icon-192.png', size: 192, mark: 0.62 },
  { file: 'icon-512.png', size: 512, mark: 0.62 },
  { file: 'icon-maskable-192.png', size: 192, mark: 0.5 },
  { file: 'icon-maskable-512.png', size: 512, mark: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, mark: 0.58 },
];

const browser = await chromium.launch();
for (const { file, size, mark } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<!doctype html><style>
      html, body { margin: 0; height: 100%; background: ${BACKGROUND}; }
      body { display: grid; place-items: center; }
      svg { width: ${Math.round(size * mark)}px; height: auto; display: block; }
    </style>${MARK}`,
  );
  await page.screenshot({ path: `public/icons/${file}` });
  await page.close();
}
await browser.close();
