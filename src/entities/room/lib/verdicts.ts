import type { Player, Room } from '../model/room';
import type { Verdict } from '../model/room';

interface Answering {
  playerId: string;
  nickname: string;
  points: number;
  scoreBefore: number;
}

/**
 * Tells verdicts from the room's realtime changes. A wrong answer reopens the buzzers. A correct
 * one reveals the answer, but so does skipping the question: only the answerer's score rising
 * tells them apart, and that update may arrive before or after the room's.
 */
export class VerdictTracker {
  private previousState: Room['state'] | null = null;
  private answering: Answering | null = null;
  private awaitingScore: Answering | null = null;
  private count = 0;

  observe(room: Room | null, players: readonly Player[]): Verdict | null {
    if (!room) {
      this.previousState = null;
      this.answering = this.awaitingScore = null;
      return null;
    }
    const scoreOf = (id: string) => players.find((player) => player.id === id)?.score;
    let verdict: Verdict | null = null;

    if (room.state === 'buzzed' && room.buzz_winner_player_id && !this.answering) {
      const player = players.find((p) => p.id === room.buzz_winner_player_id);
      if (player && this.previousState !== null) {
        this.answering = {
          playerId: player.id,
          nickname: player.nickname,
          points: room.current_points ?? 0,
          scoreBefore: player.score,
        };
      }
    }

    if (this.previousState === 'buzzed' && room.state !== 'buzzed' && this.answering) {
      if (room.state === 'buzzing_open') verdict = this.make(this.answering, false);
      else if (room.state === 'answer_shown') this.awaitingScore = this.answering;
      this.answering = null;
    }

    const waiting = this.awaitingScore;
    if (waiting) {
      const score = scoreOf(waiting.playerId);
      if (room.state !== 'answer_shown') this.awaitingScore = null;
      else if (score !== undefined && score > waiting.scoreBefore) {
        verdict = this.make(waiting, true);
        this.awaitingScore = null;
      }
    }

    this.previousState = room.state;
    return verdict;
  }

  private make(answering: Answering, correct: boolean): Verdict {
    const { playerId, nickname, points } = answering;
    return { id: ++this.count, correct, playerId, nickname, points };
  }
}
