import { Injectable, signal } from '@angular/core';

export type GameSound = 'buzz' | 'correct' | 'wrong';

const TONES: Record<GameSound, readonly number[]> = {
  buzz: [660],
  correct: [523, 784],
  wrong: [196, 147],
};

const NOTE_SECONDS = 0.14;
const PEAK_GAIN = 0.15;

/** Short synthesized cues: no audio files to host. Off until the person turns it on. */
@Injectable({ providedIn: 'root' })
export class Sound {
  readonly enabled = signal(false);
  private context: AudioContext | null = null;

  /** Call from a click: browsers only allow audio after a user gesture. */
  toggle(): void {
    this.enabled.update((on) => !on);
    if (this.enabled()) this.context ??= new AudioContext();
    void this.context?.resume();
  }

  play(sound: GameSound): void {
    const context = this.context;
    if (!this.enabled() || !context) return;
    TONES[sound].forEach((frequency, index) => {
      const start = context.currentTime + index * NOTE_SECONDS;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(PEAK_GAIN, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + NOTE_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + NOTE_SECONDS);
    });
  }
}
