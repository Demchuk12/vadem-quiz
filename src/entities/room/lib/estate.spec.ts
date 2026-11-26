import type { EstateCell } from '../model/room';
import { estatePlace, propertyMoves, redeemCost, rentOf } from './estate';

const city = (idx: number, patch: Partial<EstateCell> = {}): EstateCell => ({
  room_id: 'r',
  idx,
  kind: 'city',
  name: `C${idx}`,
  region: 0,
  price: 600,
  rents: [50, 240, 660, 1560, 2520],
  house_cost: 500,
  owner_id: 'ann',
  level: 0,
  mortgaged: false,
  ...patch,
});

describe('estate board', () => {
  it('lays the ring out from the bottom right corner', () => {
    expect(estatePlace(0)).toEqual({ row: 9, column: 9, side: 'corner' });
    expect(estatePlace(7)).toEqual({ row: 9, column: 2, side: 'bottom' });
    expect(estatePlace(12)).toMatchObject({ row: 5, column: 1, side: 'left' });
    expect(estatePlace(20)).toMatchObject({ row: 1, column: 5, side: 'top' });
    expect(estatePlace(31)).toMatchObject({ row: 8, column: 9, side: 'right' });
  });

  it('charges rent as the database does', () => {
    const cells = [city(1), city(3, { owner_id: 'bob' })];
    expect(rentOf(cells, cells[0]!)).toBe(50);
    const whole = [city(1), city(3)];
    expect(rentOf(whole, whole[0]!)).toBe(100);
    expect(rentOf(whole, city(1, { level: 4 }))).toBe(2520);
    expect(rentOf(whole, city(1, { mortgaged: true }))).toBe(0);
    expect(redeemCost(city(1))).toBe(330);
  });

  it('builds evenly on a whole region and mortgages only bare land', () => {
    const cells = [city(1, { level: 1 }), city(3)];
    expect(propertyMoves(cells, cells[0]!, 'ann', 5000)).toMatchObject({
      build: false,
      sell: true,
      mortgage: false,
    });
    expect(propertyMoves(cells, cells[1]!, 'ann', 5000).build).toBe(true);
    expect(propertyMoves(cells, cells[1]!, 'ann', 100).build).toBe(false);
  });
});
