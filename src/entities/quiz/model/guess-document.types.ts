/** A question of the "На око" game: its answer is a number, and the closest guess wins. */
export interface GuessQuestion {
  text: string;
  /** Null until the host enters it. */
  answer: number | null;
  /** What the number counts: "км", "років". Optional. */
  unit: string;
  /** Optional: told once the answer is revealed. */
  explanation: string;
}

export interface GuessDocument {
  title: string;
  mode: 'guess';
  guesses: GuessQuestion[];
  /** Seconds to answer; null means the host moves on by hand. */
  guessSeconds?: number | null;
}
