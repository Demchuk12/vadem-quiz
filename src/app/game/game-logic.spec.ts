import {
  boardColumns,
  boardRows,
  buzzerStateFor,
  everyoneSpent,
  formatScore,
  newerRoom,
  rankPlayers,
  upsertById,
} from './game-logic';
import type { Player, Room, RoomCell } from './models';

const room = (patch: Partial<Room> = {}): Room => ({
  id: 'r',
  code: 'ABCDE',
  quiz_title: 'Q',
  state: 'board',
  round: 1,
  round_count: 3,
  current_cell_id: null,
  current_points: null,
  question_text: null,
  question_image_path: null,
  answer_text: null,
  answer_image_path: null,
  buzz_winner_player_id: null,
  spent_player_ids: [],
  version: 1,
  ...patch,
});

const player = (id: string, score: number): Player => ({
  id,
  room_id: 'r',
  nickname: id,
  score,
  joined_at: '',
});

const cell = (round: number, category: number, position: number): RoomCell => ({
  id: `${round}-${category}-${position}`,
  room_id: 'r',
  round,
  category_position: category,
  category_title: `C${category}`,
  position,
  points: position * 200,
  played: false,
});

describe('boardColumns', () => {
  it('keeps only the round and orders columns and tiles', () => {
    const columns = boardColumns(
      [cell(1, 2, 2), cell(1, 1, 2), cell(2, 1, 1), cell(1, 2, 1), cell(1, 1, 1)],
      1,
    );
    expect(columns.map((column) => column.title)).toEqual(['C1', 'C2']);
    expect(columns[0]!.cells.map((c) => c.position)).toEqual([1, 2]);
    expect(boardRows(columns)).toBe(2);
  });

  it('survives an empty board', () => {
    expect(boardColumns([], 1)).toEqual([]);
    expect(boardRows([])).toBe(1);
  });
});

describe('rankPlayers', () => {
  it('sorts by score and shares ranks on ties', () => {
    const ranked = rankPlayers([player('c', 100), player('a', 400), player('b', 400)]);
    expect(ranked.map((r) => [r.player.id, r.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });

  it('places negative scores last and does not mutate its input', () => {
    const input = [player('a', -200), player('b', 0)];
    expect(rankPlayers(input).map((r) => r.player.id)).toEqual(['b', 'a']);
    expect(input[0]!.id).toBe('a');
  });
});

describe('formatScore', () => {
  it('uses a typographic minus and keeps zero plain', () => {
    expect(formatScore(-400)).toBe('−400');
    expect(formatScore(0)).toBe('0');
  });
});

describe('buzzerStateFor', () => {
  it('is ready only while presses are open', () => {
    expect(buzzerStateFor(room({ state: 'buzzing_open' }), 'p')).toBe('ready');
    expect(buzzerStateFor(room({ state: 'question_shown' }), 'p')).toBe('locked');
  });

  it('shows the winner and locks everybody else', () => {
    const buzzed = room({ state: 'buzzed', buzz_winner_player_id: 'p' });
    expect(buzzerStateFor(buzzed, 'p')).toBe('won');
    expect(buzzerStateFor(buzzed, 'q')).toBe('locked');
  });

  it('keeps a player who answered wrong out of the reopened round', () => {
    const reopened = room({ state: 'buzzing_open', spent_player_ids: ['p'] });
    expect(buzzerStateFor(reopened, 'p')).toBe('spent');
    expect(buzzerStateFor(reopened, 'q')).toBe('ready');
  });
});

describe('everyoneSpent', () => {
  const players = [player('p', 0), player('q', 0)];

  it('is true only when nobody may press any more', () => {
    expect(everyoneSpent(room({ state: 'buzzing_open', spent_player_ids: ['p'] }), players)).toBe(
      false,
    );
    expect(
      everyoneSpent(room({ state: 'buzzing_open', spent_player_ids: ['p', 'q'] }), players),
    ).toBe(true);
  });

  it('is false with no players or outside open presses', () => {
    expect(everyoneSpent(room({ state: 'buzzing_open' }), [])).toBe(false);
    expect(everyoneSpent(room({ state: 'board', spent_player_ids: ['p', 'q'] }), players)).toBe(
      false,
    );
  });
});

describe('newerRoom', () => {
  it('ignores an older version and accepts the same or a newer one', () => {
    const current = room({ version: 5, state: 'buzzed' });
    expect(newerRoom(current, room({ version: 4 }))).toBe(current);
    expect(newerRoom(current, room({ version: 6 })).version).toBe(6);
    expect(newerRoom(null, room({ version: 1 })).version).toBe(1);
  });
});

describe('upsertById', () => {
  it('replaces by id or appends, without mutating', () => {
    const items = [{ id: 'a', n: 1 }];
    expect(upsertById(items, { id: 'a', n: 2 })).toEqual([{ id: 'a', n: 2 }]);
    expect(upsertById(items, { id: 'b', n: 3 })).toHaveLength(2);
    expect(items[0]!.n).toBe(1);
  });
});
