import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectMessages } from '@shared/i18n';
import {
  AiProviderIcon,
  GUESS_QUESTIONS,
  QuizWriter,
  SavedQuizzes,
  applyGeneratedGuesses,
  documentProgress,
  type GuessDocument,
} from '@entities/quiz';
import { apiAction } from '@shared/api';
import { QuestionLoader } from '@shared/ui';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdCharacterCount } from '@vadem/ui/character-count';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdOption, VdSelect } from '@vadem/ui/select';
import { VdToaster } from '@vadem/ui/toast';
import { MAX_PROMPT_LENGTH } from '../../config/prompt';
import { OwnAiSettings } from '../own-ai-settings/own-ai-settings';
import { MESSAGES } from '../../i18n/messages';

/**
 * Writes the questions of a "На око" quiz from a topic, each with its number. The result is a draft
 * in the editor: the host reviews and saves it.
 */
@Component({
  selector: 'vq-guess-generator',
  imports: [
    ReactiveFormsModule,
    AiProviderIcon,
    QuestionLoader,
    VdAlertDialog,
    VdButton,
    VD_CARD,
    VdCharacterCount,
    VdField,
    VdIcon,
    VdInput,
    VdOption,
    VdSelect,
    OwnAiSettings,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './guess-generator.scss',
  templateUrl: './guess-generator.html',
})
export class GuessGenerator {
  protected readonly t = injectMessages(MESSAGES);
  readonly quizId = input.required<string>();
  readonly quiz = input.required<GuessDocument>();
  readonly generated = output<GuessDocument>();

  protected readonly ai = inject(QuizWriter);
  private readonly saved = inject(SavedQuizzes);
  private readonly toaster = inject(VdToaster);
  private readonly action = apiAction();

  protected readonly maxLength = MAX_PROMPT_LENGTH;
  protected readonly busy = this.action.busy;
  protected readonly confirming = signal(false);

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
  protected readonly prompt = toSignal(this.form.controls.prompt.valueChanges, {
    initialValue: '',
  });

  /** As many questions as the quiz has, within what a game takes. */
  protected count(): number {
    return Math.min(GUESS_QUESTIONS.max, Math.max(GUESS_QUESTIONS.min, this.quiz().guesses.length));
  }

  protected start(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    if (documentProgress(this.quiz()).complete > 0) this.confirming.set(true);
    else void this.generate();
  }

  protected readonly replace = async (): Promise<void> => {
    this.confirming.set(false);
    void this.generate();
  };

  private async generate(): Promise<void> {
    const token = this.saved.find(this.quizId())?.token;
    if (!token) return;
    let writer = '';
    const done = await this.action.run(
      async () => {
        const result = await this.ai.write({
          mode: 'guess',
          quizId: this.quizId(),
          token,
          prompt: this.form.controls.prompt.value.trim(),
          round: 1,
          roundCount: 1,
          categories: 1,
          questions: this.count(),
          avoid: [],
          avoidAnswers: [],
          images: false,
          explain: true,
        });
        writer = result.writer;
        this.generated.emit(applyGeneratedGuesses(this.quiz(), result.round));
      },
      { errorTitle: this.t().guesses.failed },
    );
    if (done) {
      this.toaster.success(this.t().guesses.done, this.t().guesses.doneText(writer));
    }
  }
}
