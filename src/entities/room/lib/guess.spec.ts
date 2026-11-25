import type { Player, Room } from '../model/room';
import { guessRows, scalePositions } from './guess';

describe('scalePositions', () => {
  it('keeps the side and the order of the answers', () => {
    const [exact, under, over, farOver] = scalePositions(100, [100, 90, 120, 200]);
    expect(exact).toBe(0);
    expect(under!).toBeLessThan(0);
    expect(over!).toBeGreaterThan(Math.abs(under!));
    expect(farOver).toBe(1);
  });

  it('does not let one wild answer squash the rest together', () => {
    const [near, middle, wild] = scalePositions(100, [101, 150, 1e12]);
    expect(wild).toBe(1);
    expect(near!).toBeLessThan(0.1);
    expect(middle!).toBeCloseTo(0.5);
  });

  it('puts everyone in the middle when all are exact', () => {
    expect(scalePositions(5, [5, 5])).toEqual([0, 0]);
    expect(scalePositions(5, [])).toEqual([]);
  });
});

describe('guessRows', () => {
  const players = [{ id: 'ann', nickname: 'Ann' }] as Player[];
  const room = {
    answer_text: '100.5',
    guess_results: [{ player_id: 'ann', value: 98, place: 1, delta: 3, exact: false }],
  } as Room;

  it('names the player and their miss', () => {
    expect(guessRows(room, players)).toEqual([
      expect.objectContaining({ nickname: 'Ann', distance: 2.5, position: -1 }),
    ]);
  });

  it('has nothing before the reveal', () => {
    expect(guessRows({ ...room, answer_text: null, guess_results: null }, players)).toEqual([]);
  });
});
