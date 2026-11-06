import { Injectable } from '@angular/core';

export interface SavedQuiz {
  id: string;
  token: string;
  title: string;
  /** The last room started from this quiz, so the host can get back to it. */
  lastRoomCode?: string;
}

export interface PlayerSession {
  roomId: string;
  playerId: string;
  token: string;
}

const QUIZZES_KEY = 'vq.quizzes';
const hostKey = (code: string) => `vq.host.${code}`;
const playerKey = (code: string) => `vq.player.${code}`;

/**
 * Secrets of this device. Storage may throw or be empty (private mode); the app then simply
 * behaves like a new device.
 */
@Injectable({ providedIn: 'root' })
export class LocalStore {
  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Without storage the session lasts until the page closes.
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clean up.
    }
  }

  quizzes(): SavedQuiz[] {
    return this.read<SavedQuiz[]>(QUIZZES_KEY) ?? [];
  }

  quiz(id: string): SavedQuiz | undefined {
    return this.quizzes().find((quiz) => quiz.id === id);
  }

  saveQuiz(quiz: SavedQuiz): void {
    this.write(QUIZZES_KEY, [quiz, ...this.quizzes().filter((q) => q.id !== quiz.id)]);
  }

  forgetQuiz(id: string): void {
    this.write(
      QUIZZES_KEY,
      this.quizzes().filter((quiz) => quiz.id !== id),
    );
  }

  hostToken(code: string): string | null {
    return this.read<string>(hostKey(code));
  }

  saveHostToken(code: string, token: string): void {
    this.write(hostKey(code), token);
  }

  playerSession(code: string): PlayerSession | null {
    return this.read<PlayerSession>(playerKey(code));
  }

  savePlayerSession(code: string, session: PlayerSession): void {
    this.write(playerKey(code), session);
  }

  forgetPlayerSession(code: string): void {
    this.remove(playerKey(code));
  }
}
