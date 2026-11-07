import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import {
  addCategory,
  isQuestionComplete,
  pointsOf,
  removeCategory,
  updateCategory,
  updateQuestion,
  type QuizDocument,
  type QuizQuestion,
} from '@entities/quiz';
import { AiEdit } from '@features/edit-with-ai';
import { QuestionImage } from '@features/upload-image';
import { VD_ACCORDION } from '@vadem/ui/accordion';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VD_NUMBER_INPUT } from '@vadem/ui/number-input';
import { VD_TABS } from '@vadem/ui/tabs';

/** Edits a quiz document in memory. Saving belongs to the page. */
@Component({
  selector: 'vq-quiz-editor',
  imports: [
    VD_ACCORDION,
    VdButton,
    VD_CARD,
    VdField,
    VdIcon,
    VdInput,
    VD_NUMBER_INPUT,
    VD_TABS,
    AiEdit,
    QuestionImage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-editor.scss',
  templateUrl: './quiz-editor.html',
})
export class QuizEditor {
  readonly quizId = input.required<string>();
  readonly quiz = model.required<QuizDocument>();

  private readonly roundCount = computed(() => this.quiz().rounds.length);
  /** An import may bring fewer rounds, so the open tab goes back to the first. */
  protected readonly activeRound = linkedSignal<number, string>({
    source: this.roundCount,
    computation: () => '0',
  });

  protected readonly isComplete = isQuestionComplete;

  /** Parts the AI is rewriting now, and the one it just changed, keyed "round-category-question". */
  protected readonly working = signal<ReadonlySet<string>>(new Set());
  protected readonly flashed = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  protected setWorking(key: string, on: boolean): void {
    this.working.update((keys) => {
      const next = new Set(keys);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /** Shows the host what changed: the edited part glows once. */
  protected aiEdited(quiz: QuizDocument, key: string): void {
    this.quiz.set(quiz);
    this.flashed.set(null);
    clearTimeout(this.flashTimer);
    queueMicrotask(() => this.flashed.set(key));
    this.flashTimer = setTimeout(() => this.flashed.set(null), 1600);
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected points(question: QuizQuestion, round: number): number {
    return pointsOf(question.basePoints, round, this.quiz());
  }

  protected setTitle(event: Event): void {
    this.quiz.update((quiz) => ({ ...quiz, title: this.valueOf(event) }));
  }

  protected setMultiplier(round: number, event: Event): void {
    const value = Number(this.valueOf(event));
    if (!Number.isInteger(value) || value < 1) return;
    this.quiz.update((quiz) => ({
      ...quiz,
      roundMultipliers: quiz.roundMultipliers.map((m, i) => (i === round ? value : m)),
    }));
  }

  protected setCategoryTitle(round: number, category: number, event: Event): void {
    const title = this.valueOf(event);
    this.quiz.update((quiz) => updateCategory(quiz, round, category, (c) => ({ ...c, title })));
  }

  protected addCategory(round: number): void {
    this.quiz.update((quiz) => addCategory(quiz, round));
  }

  protected removeCategory(round: number, category: number): void {
    this.quiz.update((quiz) => removeCategory(quiz, round, category));
  }

  protected setQuestion(
    round: number,
    category: number,
    question: number,
    patch: Partial<QuizQuestion>,
  ): void {
    this.quiz.update((quiz) => updateQuestion(quiz, { round, category, question }, patch));
  }
}
