import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedQuizzes } from '@entities/quiz';
import { DeleteQuizButton } from '@features/delete-quiz';
import { StartRoomButton } from '@features/start-room';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VD_EMPTY_STATE } from '@vadem/ui/empty-state';
import { VdIcon } from '@vadem/ui/icon';

/** The quizzes of this browser and what can be done with each. */
@Component({
  selector: 'vq-quiz-list',
  imports: [
    RouterLink,
    DeleteQuizButton,
    StartRoomButton,
    VdBadge,
    VdButton,
    VD_CARD,
    VD_EMPTY_STATE,
    VdIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-list.scss',
  templateUrl: './quiz-list.html',
})
export class QuizList {
  private readonly saved = inject(SavedQuizzes);

  protected readonly quizzes = signal(this.saved.list());

  protected refresh(): void {
    this.quizzes.set(this.saved.list());
  }
}
