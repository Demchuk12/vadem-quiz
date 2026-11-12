import { PhaseClock, bluffKey, bluffResult, factStem, secondsLeft, votableOptions } from './bluff';
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
    expect(secondsLeft(10_200, 0)).toBe(11);
    expect(secondsLeft(0, 5_000)).toBe(0);
    expect(secondsLeft(null, 0)).toBe(0);
  });

  it('runs a phase seen to begin for its full length, whatever the database clock says', () => {
    const clock = new PhaseClock();
    const room = (state: Room['state'], endsAt: string | null) =>
      ({ round: 1, state, phase_ends_at: endsAt, writing_seconds: 30, voting_seconds: 20 }) as Room;
    // Opened mid-phase: only the database's end time is known.
    expect(clock.observe(room('bluff_writing', '1970-01-01T00:00:05Z'), 1_000)).toBe(5_000);
    expect(clock.observe(room('bluff_writing', '1970-01-01T00:00:05Z'), 2_000)).toBe(5_000);
    // Seen to begin: twenty seconds from now, though the database clock is a minute behind.
    expect(clock.observe(room('bluff_voting', '1969-12-31T23:59:30Z'), 3_000)).toBe(23_000);
    expect(clock.observe(room('bluff_reveal', null), 4_000)).toBeNull();
  });

  it('times the presses of a board with a clock, and nothing without one', () => {
    const clock = new PhaseClock();
    const board = (state: Room['state'], buzzSeconds: number | null) =>
      ({
        round: 1,
        state,
        phase_ends_at: '1970-01-01T00:00:01Z',
        buzz_seconds: buzzSeconds,
      }) as Room;
    expect(clock.observe(board('question_shown', 10), 0)).toBeNull();
    expect(clock.observe(board('buzzing_open', 10), 1_000)).toBe(11_000);
    expect(clock.observe(board('buzzed', 10), 2_000)).toBeNull();
    expect(new PhaseClock().observe(board('buzzing_open', null), 0)).toBeNull();
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
