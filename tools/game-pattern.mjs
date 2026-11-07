// Writes public/brand/game-pattern.svg: the page background, drawn from the game's own objects.
// Deterministic, so the output only changes when this file does. Run: node tools/game-pattern.mjs
import { writeFileSync } from 'node:fs';

const TILE = 960;
const CELLS = 6;
const CELL = TILE / CELLS;
/** Keeps every shape inside its cell, so the tile repeats without visible seams. */
const MAX_SCALE = 1.5;

// sRGB of the app's accent (--vd-accent-500 at hue 158), a lighter step, the "first!" amber, a neutral.
const GREEN = '#00A768';
const MINT = '#5FD3A3';
const AMBER = '#D19536';
const LIGHT = '#ECECF1';

const question = (color) =>
  `<g fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M-15-17a15 15 0 1 1 23 13c-6 4-8 7-8 12"/></g><circle cy="26" r="5.5" fill="${color}"/>`;

const tileWithQuestion = (color) =>
  `<rect x="-34" y="-34" width="68" height="68" rx="16" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-width="2.5"/>` +
  `<g transform="scale(.62)">${question(color)}</g>`;

const emptyTile = (color) =>
  `<rect x="-30" y="-30" width="60" height="60" rx="14" fill="none" stroke="${color}" stroke-width="2.5"/>`;

const buzzer = (color) =>
  `<circle r="34" fill="none" stroke="${color}" stroke-width="2.5"/>` +
  `<circle r="23" fill="${color}" fill-opacity=".22"/><circle r="12" fill="${color}"/>`;

const star = (color) =>
  `<path d="M0-30 9-10 31-8 15 7 19 29 0 18-19 29-15 7-31-8-9-10Z" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;

const blocks = (color) =>
  `<g fill="${color}"><rect x="-32" y="-32" width="28" height="28" rx="8" opacity=".5"/>` +
  `<rect x="4" y="-32" width="28" height="28" rx="8" opacity=".8"/><rect x="-14" y="4" width="28" height="28" rx="8"/></g>`;

// Question marks lead; each other object appears often enough to read as "a game".
const SHAPES = [
  [question, GREEN],
  [tileWithQuestion, GREEN],
  [question, MINT],
  [buzzer, GREEN],
  [question, LIGHT],
  [star, AMBER],
  [tileWithQuestion, MINT],
  [blocks, GREEN],
  [question, GREEN],
  [emptyTile, MINT],
  [question, AMBER],
  [tileWithQuestion, LIGHT],
];

/** Small seeded generator (mulberry32). */
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(158);
const parts = [];
for (let row = 0; row < CELLS; row += 1) {
  for (let column = 0; column < CELLS; column += 1) {
    const [draw, color] = SHAPES[Math.floor(next() * SHAPES.length)];
    const scale = 0.8 + next() * (MAX_SCALE - 0.8);
    const margin = CELL / 2 - 36 * scale;
    const x = (column + 0.5) * CELL + (next() * 2 - 1) * margin;
    const y = (row + 0.5) * CELL + (next() * 2 - 1) * margin;
    const angle = Math.round((next() * 2 - 1) * 24);
    const opacity = (0.45 + next() * 0.5).toFixed(2);
    parts.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})" opacity="${opacity}">${draw(color)}</g>`,
    );
  }
}

writeFileSync(
  'public/brand/game-pattern.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" width="${TILE}" height="${TILE}">${parts.join('')}</svg>\n`,
);
