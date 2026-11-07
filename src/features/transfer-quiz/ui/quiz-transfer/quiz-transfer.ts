import { ChangeDetectionStrategy, Component, DOCUMENT, inject, input, output } from '@angular/core';
import { QuizImportError, parseQuizDocument, type QuizDocument } from '@entities/quiz';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';
import { VdToaster } from '@vadem/ui/toast';

/** Import and export of a quiz as a JSON file: also the only backup of a browser-bound quiz. */
@Component({
  selector: 'vq-quiz-transfer',
  imports: [VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quiz-transfer.scss',
  templateUrl: './quiz-transfer.html',
})
export class QuizTransfer {
  readonly quizId = input.required<string>();
  readonly quiz = input.required<QuizDocument>();
  readonly imported = output<QuizDocument>();

  private readonly toaster = inject(VdToaster);
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
      this.imported.emit(document);
      this.toaster.success(
        'Квіз імпортовано, збережіть його',
        droppedImages > 0
          ? `Картинок з іншого квізу прибрано: ${droppedImages}. Їх треба завантажити знову.`
          : undefined,
      );
    } catch (error) {
      const message =
        error instanceof QuizImportError ? error.message : 'Не вдалося прочитати файл';
      this.toaster.error('Імпорт не вдався', message);
    }
  }
}
