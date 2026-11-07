import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AiProviderIcon,
  AiWriter,
  SavedQuizzes,
  applyGeneratedRound,
  quizProgress,
  roundShape,
  type QuizDocument,
} from '@entities/quiz';
import { apiAction } from '@shared/api';
import { QuestionLoader } from '@shared/ui';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdCheckbox } from '@vadem/ui/checkbox';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdOption, VdSelect } from '@vadem/ui/select';
import { VdToaster } from '@vadem/ui/toast';

const MAX_PROMPT_LENGTH = 500;

/** Where an interrupted generation stopped: the next round to write, and what it must not repeat. */
interface Progress {
  prompt: string;
  round: number;
  avoid: string[];
}

/** Writes the quiz from a topic. The result is a draft in the editor: the host reviews and saves it. */
@Component({
  selector: 'vq-quiz-generator',
  imports: [
    ReactiveFormsModule,
    AiProviderIcon,
    QuestionLoader,
    VdAlertDialog,
    VdButton,
    VD_CARD,
    VdCheckbox,
    VdField,
    VdIcon,
    VdInput,
    VdOption,
    VdSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-generator.scss',
  templateUrl: './quiz-generator.html',
})
export class QuizGenerator {
  readonly quizId = input.required<string>();
  readonly quiz = input.required<QuizDocument>();
  readonly generated = output<QuizDocument>();

  protected readonly ai = inject(AiWriter);
  private readonly saved = inject(SavedQuizzes);
  private readonly toaster = inject(VdToaster);
  private readonly action = apiAction();

  protected readonly maxLength = MAX_PROMPT_LENGTH;
  protected readonly busy = this.action.busy;
  protected readonly confirming = signal(false);
  private readonly currentRound = signal(0);
  protected readonly status = computed(
    () => `Пишемо раунд ${this.currentRound()} з ${this.quiz().rounds.length}…`,
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
    images: false,
  });

  private readonly prompt = toSignal(this.form.controls.prompt.valueChanges, { initialValue: '' });
  private readonly interrupted = signal<Progress | null>(null);
  /** A failed run continues where it stopped, as long as the topic stays the same. */
  private readonly resumable = computed(() => {
    const progress = this.interrupted();
    return progress && progress.round > 0 && progress.prompt === this.prompt().trim()
      ? progress
      : null;
  });
  protected readonly actionLabel = computed(() => {
    const progress = this.resumable();
    return progress ? `Продовжити з раунду ${progress.round + 1}` : 'Згенерувати';
  });

  protected start(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const progress = this.resumable();
    if (progress) void this.generate(progress);
    else if (quizProgress(this.quiz()).complete > 0) this.confirming.set(true);
    else void this.generate();
  }

  protected readonly replace = async (): Promise<void> => {
    this.confirming.set(false);
    void this.generate();
  };

  /** Round by round: a failure keeps what is already written and costs only the current round. */
  private async generate(from?: Progress): Promise<void> {
    const token = this.saved.find(this.quizId())?.token;
    if (!token) return;
    const prompt = this.form.controls.prompt.value.trim();
    const writers = new Set<string>();

    const done = await this.action.run(
      async () => {
        let quiz = this.quiz();
        const roundCount = quiz.rounds.length;
        const avoid = [...(from?.avoid ?? [])];
        for (let round = from?.round ?? 0; round < roundCount; round += 1) {
          this.interrupted.set({ prompt, round, avoid: [...avoid] });
          this.currentRound.set(round + 1);
          const result = await this.ai.write({
            quizId: this.quizId(),
            token,
            prompt,
            round: round + 1,
            roundCount,
            ...roundShape(quiz, round),
            avoid,
            images: this.form.controls.images.value,
          });
          writers.add(result.writer);
          quiz = applyGeneratedRound(quiz, round, result.round);
          avoid.push(...result.round.categories.map((category) => category.title));
          this.generated.emit(quiz);
        }
        this.interrupted.set(null);
      },
      { errorTitle: 'Не все вдалося згенерувати' },
    );
    if (done) {
      this.toaster.success(
        'Квіз написано',
        `Писав ${[...writers].join(', ')}. Перевірте факти й збережіть його.`,
      );
    }
  }
}
