import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  BLUFF_FACTS,
  BLUFF_LENGTHS,
  BLUFF_SECONDS,
  addFact,
  isFactComplete,
  removeFact,
  swapDecoy,
  updateFact,
  type BluffDocument,
  type BluffFact,
} from '@entities/quiz';
import { ClockSetting } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';

/** The facts of a "Варіанти" quiz: each with its missing ending and the host's decoy. */
@Component({
  selector: 'vq-bluff-editor',
  imports: [ClockSetting, VdButton, VD_CARD, VdField, VdIcon, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-editor.scss',
  templateUrl: './bluff-editor.html',
})
export class BluffEditor {
  readonly quiz = input.required<BluffDocument>();
  readonly quizChange = output<BluffDocument>();

  protected readonly limits = BLUFF_FACTS;
  protected readonly lengths = BLUFF_LENGTHS;
  protected readonly seconds = BLUFF_SECONDS;
  protected readonly isComplete = isFactComplete;

  protected setTitle(event: Event): void {
    this.quizChange.emit({ ...this.quiz(), title: this.valueOf(event) });
  }

  protected setClock(
    patch: Pick<BluffDocument, 'writingSeconds'> | Pick<BluffDocument, 'votingSeconds'>,
  ): void {
    this.quizChange.emit({ ...this.quiz(), ...patch });
  }

  protected setFact(index: number, patch: Partial<BluffFact>): void {
    this.quizChange.emit(updateFact(this.quiz(), index, patch));
  }

  protected add(): void {
    this.quizChange.emit(addFact(this.quiz()));
  }

  protected useDecoy(index: number, idea: string): void {
    this.quizChange.emit(swapDecoy(this.quiz(), index, idea));
  }

  protected remove(index: number): void {
    this.quizChange.emit(removeFact(this.quiz(), index));
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
