import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { QuizApi, SavedQuizzes, emptyQuiz } from '@entities/quiz';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';

@Component({
  selector: 'vq-create-quiz-form',
  imports: [ReactiveFormsModule, VdButton, VdField, VdIcon, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './create-quiz-form.scss',
  templateUrl: './create-quiz-form.html',
})
export class CreateQuizForm {
  private readonly api = inject(QuizApi);
  private readonly saved = inject(SavedQuizzes);
  private readonly router = inject(Router);
  private readonly action = apiAction();

  protected readonly busy = this.action.busy;
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
  });

  protected async create(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const title = this.form.controls.title.value.trim();
    await this.action.run(async () => {
      const quiz = await this.api.create(title);
      await this.api.save(quiz.quiz_id, quiz.owner_token, emptyQuiz(title));
      this.saved.save({ id: quiz.quiz_id, token: quiz.owner_token, title });
      await this.router.navigate(['/quizzes', quiz.quiz_id]);
    });
  }
}
