import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { QuizApi, SavedQuizzes, type SavedQuiz } from '@entities/quiz';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';

@Component({
  selector: 'vq-delete-quiz-button',
  imports: [VdAlertDialog, VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-quiz-button.html',
})
export class DeleteQuizButton {
  readonly quiz = input.required<SavedQuiz>();
  readonly deleted = output<void>();

  private readonly api = inject(QuizApi);
  private readonly saved = inject(SavedQuizzes);

  protected readonly confirming = signal(false);

  protected readonly remove = async (): Promise<void> => {
    const quiz = this.quiz();
    await this.api.delete(quiz.id, quiz.token);
    this.saved.forget(quiz.id);
    this.confirming.set(false);
    this.deleted.emit();
  };
}
