import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLUMNS = 9;
const ROWS = 6;
const CENTER_COLUMN = 4;
const V_FIRST_ROW = 1;
const V_LAST_ROW = 4;
const BASE_VALUE = 200;

/** Which step of the V a tile belongs to, as in the logo's rows: top, middle, then the tip. */
function tierOf(column: number, row: number): number | null {
  if (row < V_FIRST_ROW || row > V_LAST_ROW) return null;
  if (Math.abs(column - CENTER_COLUMN) !== V_LAST_ROW - row) return null;
  return row === V_LAST_ROW ? 3 : row === V_FIRST_ROW ? 1 : 2;
}

interface BannerTile {
  value: number;
  tier: number | null;
  order: number;
}

const TILES: readonly BannerTile[] = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: COLUMNS }, (_, column) => ({
    value: BASE_VALUE * (row + 1),
    tier: tierOf(column, row),
    order: row + Math.abs(column - CENTER_COLUMN),
  })),
).flat();

/**
 * A quiz board whose tiles light up into the V of the logo, once, when the page opens. Purely
 * decorative. It fills its positioned parent and crops at the edges.
 */
@Component({
  selector: 'vq-tile-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styleUrl: './tile-banner.scss',
  templateUrl: './tile-banner.html',
})
export class TileBanner {
  protected readonly tiles = TILES;
}
