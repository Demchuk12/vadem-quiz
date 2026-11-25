import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import {
  GUESS_LENGTHS,
  GUESS_QUESTIONS,
  GUESS_SECONDS,
  addGuess,
  isGuessComplete,
  removeGuess,
  updateGuess,
  type GuessDocument,
  type GuessQuestion,
} from '@entities/quiz';
import { I18n, injectMessages, injectNumberFormat, parseNumber } from '@shared/i18n';
import { ClockSetting } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { MESSAGES } from '../../i18n/messages';

const MAX_ANSWER = 1e12;

/** The questions of a "На око" quiz, each with its number. */
@Component({
  selector: 'vq-guess-editor',
  imports: [ClockSetting, VdButton, VD_CARD, VdField, VdIcon, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './guess-editor.scss',
  templateUrl: './guess-editor.html',
})
export class GuessEditor {
  protected readonly t = injectMessages(MESSAGES);
  readonly quiz = input.required<GuessDocument>();
  readonly quizChange = output<GuessDocument>();

  private readonly i18n = inject(I18n);
  private readonly format = injectNumberFormat();

  protected readonly limits = GUESS_QUESTIONS;
  protected readonly lengths = GUESS_LENGTHS;
  protected readonly defaultSeconds = GUESS_SECONDS;
  protected readonly isComplete = isGuessComplete;
  /** What was typed as an answer but is no number, by question. */
  private readonly wrong = signal<ReadonlyMap<number, string>>(new Map());

  protected answerText(index: number, question: GuessQuestion): string {
    return question.answer === null
      ? (this.wrong().get(index) ?? '')
      : this.format(question.answer);
  }

  protected isWrong(index: number, question: GuessQuestion): boolean {
    return question.answer === null && this.wrong().has(index);
  }

  protected setAnswer(index: number, event: Event): void {
    const text = this.valueOf(event).trim();
    const answer = parseNumber(text, this.i18n.locale());
    const bad = text !== '' && (answer === null || Math.abs(answer) > MAX_ANSWER);
    this.wrong.update((wrong) => {
      const next = new Map(wrong);
      if (bad) next.set(index, text);
      else next.delete(index);
      return next;
    });
    this.set(index, { answer: bad ? null : answer });
  }

  protected setTitle(event: Event): void {
    this.quizChange.emit({ ...this.quiz(), title: this.valueOf(event) });
  }

  protected setClock(guessSeconds: number | null): void {
    this.quizChange.emit({ ...this.quiz(), guessSeconds });
  }

  protected set(index: number, patch: Partial<GuessQuestion>): void {
    this.quizChange.emit(updateGuess(this.quiz(), index, patch));
  }

  protected add(): void {
    this.quizChange.emit(addGuess(this.quiz()));
  }

  protected remove(index: number): void {
    // The questions after it move up, and their typed mistakes with them.
    this.wrong.update(
      (wrong) =>
        new Map(
          [...wrong]
            .filter(([at]) => at !== index)
            .map(([at, text]) => [at > index ? at - 1 : at, text]),
        ),
    );
    this.quizChange.emit(removeGuess(this.quiz(), index));
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
