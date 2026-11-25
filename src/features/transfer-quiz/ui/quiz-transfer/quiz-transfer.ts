import { ChangeDetectionStrategy, Component, DOCUMENT, inject, input, output } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import {
  QuizImportError,
  injectImportErrorText,
  isBluff,
  parseQuizDocument,
  type AnyQuizDocument,
} from '@entities/quiz';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';
import { VdToaster } from '@vadem/ui/toast';
import { MESSAGES } from '../../i18n/messages';

/** Import and export of a quiz as a JSON file: also the only backup of a browser-bound quiz. */
@Component({
  selector: 'vq-quiz-transfer',
  imports: [VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-transfer.scss',
  templateUrl: './quiz-transfer.html',
})
export class QuizTransfer {
  protected readonly t = injectMessages(MESSAGES);
  readonly quizId = input.required<string>();
  readonly quiz = input.required<AnyQuizDocument>();
  readonly imported = output<AnyQuizDocument>();

  private readonly toaster = inject(VdToaster);
  private readonly describe = injectImportErrorText();
  private readonly document = inject(DOCUMENT);

  protected exportFile(): void {
    const quiz = this.quiz();
    const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${quiz.title || 'quiz'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { document, droppedImages } = parseQuizDocument(await file.text(), this.quizId());
      // A file of the other game would turn this quiz into it and drop what it holds.
      if (isBluff(document) !== isBluff(this.quiz())) {
        throw new QuizImportError(isBluff(document) ? 'bluff_file' : 'board_file');
      }
      this.imported.emit(document);
      this.toaster.success(
        this.t().done,
        droppedImages > 0 ? this.t().dropped(droppedImages) : undefined,
      );
    } catch (error) {
      const message = error instanceof QuizImportError ? this.describe(error) : this.t().unreadable;
      this.toaster.error(this.t().failed, message);
    }
  }
}
