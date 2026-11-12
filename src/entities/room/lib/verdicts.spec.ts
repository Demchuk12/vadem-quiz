import { VerdictTracker } from './verdicts';
import type { Player, Room } from '../model/room';

const room = (patch: Partial<Room>): Room => ({
  id: 'r',
  code: 'ABCDE',
  quiz_title: 'Q',
  mode: 'board',
  state: 'board',
  round: 1,
  round_count: 3,
  current_cell_id: 'c',
  current_points: 400,
  question_text: 'Q?',
  question_image_path: null,
  answer_text: null,
  answer_image_path: null,
  answer_explanation: null,
  buzz_winner_player_id: null,
  buzzed_at: null,
  late_presses: [],
  spent_player_ids: [],
  phase_ends_at: null,
  buzz_seconds: null,
  writing_seconds: 30,
  voting_seconds: 20,
  bluff_done: [],
  bluff_options: null,
  bluff_deltas: null,
  version: 1,
  ...patch,
});

const player = (score: number): Player => ({
  id: 'p1',
  room_id: 'r',
  nickname: 'Оксана',
  score,
  joined_at: '',
});

function buzzed(tracker: VerdictTracker) {
  tracker.observe(room({ state: 'buzzing_open' }), [player(0)]);
  return tracker.observe(room({ state: 'buzzed', buzz_winner_player_id: 'p1' }), [player(0)]);
}

describe('VerdictTracker', () => {
  it('calls a wrong answer when the buzzers reopen', () => {
    const tracker = new VerdictTracker();
    expect(buzzed(tracker)).toBeNull();
    const verdict = tracker.observe(room({ state: 'buzzing_open', spent_player_ids: ['p1'] }), [
      player(-400),
    ]);
    expect(verdict).toMatchObject({
      correct: false,
      playerId: 'p1',
      nickname: 'Оксана',
      points: 400,
    });
  });

  it('calls a correct answer once the score rises, whichever update comes first', () => {
    const roomFirst = new VerdictTracker();
    buzzed(roomFirst);
    expect(roomFirst.observe(room({ state: 'answer_shown' }), [player(0)])).toBeNull();
    expect(roomFirst.observe(room({ state: 'answer_shown' }), [player(400)])).toMatchObject({
      correct: true,
      points: 400,
    });

    const scoreFirst = new VerdictTracker();
    buzzed(scoreFirst);
    scoreFirst.observe(room({ state: 'buzzed', buzz_winner_player_id: 'p1' }), [player(400)]);
    expect(scoreFirst.observe(room({ state: 'answer_shown' }), [player(400)])).toMatchObject({
      correct: true,
    });
  });

  it('stays quiet when the host skips an answered question', () => {
    const tracker = new VerdictTracker();
    buzzed(tracker);
    expect(tracker.observe(room({ state: 'answer_shown' }), [player(0)])).toBeNull();
    expect(tracker.observe(room({ state: 'board' }), [player(0)])).toBeNull();
    expect(tracker.observe(room({ state: 'board' }), [player(400)])).toBeNull();
  });

  it('ignores a game that was already mid-answer when the screen opened', () => {
    const tracker = new VerdictTracker();
    tracker.observe(room({ state: 'buzzed', buzz_winner_player_id: 'p1' }), [player(0)]);
    expect(tracker.observe(room({ state: 'buzzing_open' }), [player(-400)])).toBeNull();
  });

  it('numbers every verdict anew', () => {
    const tracker = new VerdictTracker();
    buzzed(tracker);
    const first = tracker.observe(room({ state: 'buzzing_open' }), [player(-400)])!;
    tracker.observe(room({ state: 'buzzed', buzz_winner_player_id: 'p1' }), [player(-400)]);
    const second = tracker.observe(room({ state: 'buzzing_open' }), [player(-800)])!;
    expect(second.id).toBeGreaterThan(first.id);
  });
});
