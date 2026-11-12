import { bluffKey, bluffResult, factStem, secondsLeft, votableOptions } from './bluff';
import type { Player, Room } from '../model/room';

describe('bluff', () => {
  it('compares words as the database does', () => {
    expect(bluffKey('  «Льоду». ')).toBe('льоду');
    expect(bluffKey('пивних   бочок!')).toBe('пивних бочок');
  });

  it('hides every option with a player’s own words', () => {
    const options = [
      { id: '1', text: 'льоду' },
      { id: '2', text: 'соломи' },
      { id: '3', text: 'льоду' },
    ];
    expect(votableOptions(options, 'Льоду.').map((o) => o.id)).toEqual(['2']);
    expect(votableOptions(options, null)).toHaveLength(3);
  });

  it('counts the seconds left', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(secondsLeft({ phase_ends_at: '2026-11-12T12:00:10.2Z' }, now)).toBe(11);
    expect(secondsLeft({ phase_ends_at: '2026-11-12T11:59:00Z' }, now)).toBe(0);
    expect(secondsLeft({ phase_ends_at: null }, now)).toBe(0);
  });

  it('cuts the closing ellipsis off a fact', () => {
    expect(factStem('Готель збудований з… ')).toBe('Готель збудований з');
  });
});

describe('bluffResult', () => {
  const players = ['ann', 'bob', 'cat'].map((id): Player => ({
    id,
    room_id: 'r',
    nickname: id.toUpperCase(),
    score: 0,
    joined_at: '',
  }));
  const room = {
    bluff_options: [
      { id: 't', text: 'льоду', kind: 'truth', player_id: null, voter_ids: ['ann'] },
      { id: 'a', text: 'трамваїв', kind: 'player', player_id: 'ann', voter_ids: ['bob', 'cat'] },
      { id: 'b', text: 'бочок', kind: 'player', player_id: 'bob', voter_ids: [] },
    ],
    bluff_deltas: { ann: 4 },
  } as unknown as Room;

  it('tells a player what they picked and who fell for them', () => {
    expect(bluffResult(room, players, 'ann')).toEqual({
      delta: 4,
      picked: room.bluff_options![0],
      pickedAuthor: null,
      fooled: ['BOB', 'CAT'],
    });
    expect(bluffResult(room, players, 'bob')).toMatchObject({
      delta: 0,
      pickedAuthor: 'ANN',
      fooled: [],
    });
  });
});
