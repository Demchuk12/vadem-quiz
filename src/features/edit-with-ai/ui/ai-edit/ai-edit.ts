import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AiProviderIcon,
  AiWriter,
  SavedQuizzes,
  answersOutside,
  applyEdit,
  editSource,
  pointsOf,
  restoreEdit,
  titlesOutside,
  type EditTarget,
  type QuizDocument,
} from '@entities/quiz';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VdCharacterCount } from '@vadem/ui/character-count';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VD_POPOVER, type VdPopover } from '@vadem/ui/popover';
import { VdToaster } from '@vadem/ui/toast';
import { KINDS, type AiEditKind, type Chip } from '../../config/edit-kinds';

const MIN_LENGTH = 3;
const MAX_LENGTH = 1500;

let nextId = 0;

/**
 * Asks the AI to change one question, a category or a round by the host's words. The result
 * lands in the draft like any other edit, and the toast can take it back.
 */
@Component({
  selector: 'vq-ai-edit',
  imports: [AiProviderIcon, VdButton, VdCharacterCount, VdField, VdIcon, VdInput, VD_POPOVER],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ai-edit.scss',
  templateUrl: './ai-edit.html',
})
export class AiEdit {
  readonly quizId = input.required<string>();
  readonly quiz = input.required<QuizDocument>();
  readonly target = input.required<EditTarget>();
  readonly kind = input.required<AiEditKind>();
  /** An icon button, for tight rows; otherwise a labelled one. */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly edited = output<QuizDocument>();
  /** While the AI is writing, so the editor can show which part is changing. */
  readonly working = output<boolean>();

  protected readonly ai = inject(AiWriter);
  private readonly saved = inject(SavedQuizzes);
  private readonly toaster = inject(VdToaster);
  private readonly action = apiAction();

  protected readonly busy = this.action.busy;
  protected readonly headingId = `vq-ai-edit-${nextId++}`;
  protected readonly maxLength = MAX_LENGTH;
  protected readonly instruction = signal('');
  protected readonly texts = computed(() => KINDS[this.kind()]);
  protected readonly ready = computed(() => {
    const length = this.instruction().trim().length;
    return length >= MIN_LENGTH && length <= MAX_LENGTH;
  });

  protected readonly title = computed(() => {
    const { round } = this.target();
    return this.kind() === 'round' ? `${this.texts().title} ${round + 1}` : this.texts().title;
  });

  /** What exactly will change, in the host's terms. */
  protected readonly context = computed(() => {
    const { round, category, question } = this.target();
    const quiz = this.quiz();
    const categories = quiz.rounds[round]?.categories ?? [];
    const own = category === undefined ? undefined : categories[category];
    const name = own?.title.trim() ? `«${own.title.trim()}»` : `Категорія ${(category ?? 0) + 1}`;
    if (question !== undefined && own?.questions[question]) {
      return `${name} · ${pointsOf(own.questions[question].basePoints, round, quiz)} очок`;
    }
    if (own) return `${name} · питань: ${own.questions.length}`;
    return `Категорій: ${categories.length} · питань у кожній: ${categories[0]?.questions.length ?? 0}`;
  });

  protected readonly label = computed(() =>
    this.kind() === 'category' ? `Змінити категорію з AI` : `${this.texts().title} з AI`,
  );

  protected valueOf(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected pick(chip: Chip): void {
    this.instruction.set(chip.text);
  }

  protected async submit(event: Event, popover: VdPopover): Promise<void> {
    event.preventDefault();
    const instruction = this.instruction().trim();
    const token = this.saved.find(this.quizId())?.token;
    if (!this.ready() || this.busy() || !token) return;

    const before = this.quiz();
    const target = this.target();
    const source = editSource(before, target);
    if (!source) {
      this.toaster.error(
        'Раунд не вийде змінити цілком',
        'У його категоріях різна кількість питань. Змініть категорії по одній.',
      );
      return;
    }
    popover.hide();
    this.working.emit(true);
    await this.action.run(
      async () => {
        const result = await this.ai.write({
          quizId: this.quizId(),
          token,
          prompt: instruction,
          round: target.round + 1,
          roundCount: before.rounds.length,
          categories: source.length,
          questions: source[0]!.questions.length,
          avoid: titlesOutside(before, target),
          avoidAnswers: answersOutside(before, target),
          images: false,
          current: source,
        });
        this.edited.emit(applyEdit(this.quiz(), target, result.round));
        this.instruction.set('');
        this.toaster.show({
          title: this.texts().done,
          description: `Писав ${result.writer}. Перевірте й збережіть квіз.`,
          variant: 'success',
          action: {
            label: 'Скасувати',
            onClick: () => this.edited.emit(restoreEdit(this.quiz(), target, before)),
          },
        });
      },
      { errorTitle: 'Не вдалося змінити' },
    );
    this.working.emit(false);
  }
}
