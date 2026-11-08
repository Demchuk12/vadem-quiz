/** The notes of each game cue, in hertz, played one after another. */
export type GameSound = 'buzz' | 'correct' | 'wrong';

export const TONES: Record<GameSound, readonly number[]> = {
  buzz: [660],
  correct: [523, 784],
  wrong: [196, 147],
};
