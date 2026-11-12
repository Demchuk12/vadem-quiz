import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BLUFF_FACTS, QuizApi, SavedQuizzes, emptyBluffQuiz, emptyQuiz } from '@entities/quiz';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VD_DIALOG } from '@vadem/ui/dialog';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';

type QuizMode = 'board' | 'bluff';

const GAME_NAMES: Record<QuizMode, string> = { board: 'Своя гра', bluff: 'Варіанти' };

/** A card per kind of game; the chosen one asks for the new quiz's title. */
@Component({
  selector: 'vq-create-quiz',
  imports: [ReactiveFormsModule, VdButton, VD_CARD, VD_DIALOG, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './create-quiz.scss',
  templateUrl: './create-quiz.html',
})
export class CreateQuiz {
  private readonly api = inject(QuizApi);
  private readonly saved = inject(SavedQuizzes);
  private readonly router = inject(Router);
  private readonly action = apiAction();

  protected readonly busy = this.action.busy;
  protected readonly facts = BLUFF_FACTS;
  /** The game being created; null while the dialog is closed. */
  protected readonly mode = signal<QuizMode | null>(null);
  protected readonly gameName = computed(() => GAME_NAMES[this.mode() ?? 'board']);
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
  });

  protected choose(mode: QuizMode): void {
    this.form.reset();
    this.mode.set(mode);
  }

  protected close(): void {
    this.mode.set(null);
  }

  protected async create(): Promise<void> {
    const mode = this.mode();
    this.form.markAllAsTouched();
    if (this.form.invalid || !mode) return;

    const title = this.form.controls.title.value.trim();
    await this.action.run(async () => {
      const quiz = await this.api.create(title);
      const document = mode === 'bluff' ? emptyBluffQuiz(title) : emptyQuiz(title);
      await this.api.save(quiz.quiz_id, quiz.owner_token, document);
      this.saved.save({ id: quiz.quiz_id, token: quiz.owner_token, title, mode });
      this.mode.set(null);
      await this.router.navigate(['/quizzes', quiz.quiz_id]);
    });
  }
}
