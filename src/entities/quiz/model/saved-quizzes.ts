import { Injectable } from '@angular/core';
import { readJson, writeJson } from '@shared/lib';

export interface SavedQuiz {
  id: string;
  token: string;
  title: string;
  /** Which game it is; quizzes saved before "Варіанти" have none and are boards. */
  mode?: 'board' | 'bluff';
  /** The last room started from this quiz, so the host can get back to it. */
  lastRoomCode?: string;
}

const KEY = 'vq.quizzes';

/** Quizzes this browser owns: there are no accounts, the token is the access. */
@Injectable({ providedIn: 'root' })
export class SavedQuizzes {
  list(): SavedQuiz[] {
    return readJson<SavedQuiz[]>(KEY) ?? [];
  }

  find(id: string): SavedQuiz | undefined {
    return this.list().find((quiz) => quiz.id === id);
  }

  save(quiz: SavedQuiz): void {
    writeJson(KEY, [quiz, ...this.list().filter((q) => q.id !== quiz.id)]);
  }

  forget(id: string): void {
    writeJson(
      KEY,
      this.list().filter((quiz) => quiz.id !== id),
    );
  }
}
