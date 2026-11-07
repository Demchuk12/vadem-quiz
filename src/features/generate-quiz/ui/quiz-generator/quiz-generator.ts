import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  QuizApi,
  SavedQuizzes,
  applyGeneratedRound,
  quizProgress,
  roundShape,
  type QuizDocument,
} from '@entities/quiz';
import { apiAction } from '@shared/api';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdToaster } from '@vadem/ui/toast';

const MAX_PROMPT_LENGTH = 500;

/** Writes the quiz from a topic. The result is a draft in the editor: the host reviews and saves it. */
@Component({
  selector: 'vq-quiz-generator',
  imports: [ReactiveFormsModule, VdAlertDialog, VdButton, VD_CARD, VdField, VdIcon, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-generator.scss',
  templateUrl: './quiz-generator.html',
})
export class QuizGenerator {
  readonly quizId = input.required<string>();
  readonly quiz = input.required<QuizDocument>();
  readonly generated = output<QuizDocument>();

  private readonly api = inject(QuizApi);
  private readonly saved = inject(SavedQuizzes);
  private readonly toaster = inject(VdToaster);
  private readonly action = apiAction();

  protected readonly maxLength = MAX_PROMPT_LENGTH;
  protected readonly busy = this.action.busy;
  protected readonly confirming = signal(false);
  private readonly currentRound = signal(0);
  protected readonly status = computed(() =>
    this.busy() ? `Пишемо раунд ${this.currentRound()} з ${this.quiz().rounds.length}…` : '',
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    prompt: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(MAX_PROMPT_LENGTH),
        Validators.pattern(/\S/),
      ],
    ],
  });

  protected start(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    if (quizProgress(this.quiz()).complete > 0) this.confirming.set(true);
    else void this.generate();
  }

  protected readonly replace = async (): Promise<void> => {
    this.confirming.set(false);
    void this.generate();
  };

  /** Round by round: a failure keeps what is already written and costs only the current round. */
  private async generate(): Promise<void> {
    const token = this.saved.find(this.quizId())?.token;
    if (!token) return;
    const prompt = this.form.controls.prompt.value.trim();

    const done = await this.action.run(
      async () => {
        let quiz = this.quiz();
        const roundCount = quiz.rounds.length;
        const avoid: string[] = [];
        for (let round = 0; round < roundCount; round += 1) {
          this.currentRound.set(round + 1);
          const result = await this.api.generateRound({
            quizId: this.quizId(),
            token,
            prompt,
            round: round + 1,
            roundCount,
            ...roundShape(quiz, round),
            avoid,
          });
          quiz = applyGeneratedRound(quiz, round, result);
          avoid.push(...result.categories.map((category) => category.title));
          this.generated.emit(quiz);
        }
      },
      { errorTitle: 'Не все вдалося згенерувати' },
    );
    if (done) this.toaster.success('Квіз написано', 'Перевірте факти й збережіть його.');
  }
}
