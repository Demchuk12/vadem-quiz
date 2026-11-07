import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { VdButton } from '@vadem/ui/button';
import { VdDropzone } from '@vadem/ui/dropzone';
import { VdIcon } from '@vadem/ui/icon';
import { VdToaster } from '@vadem/ui/toast';
import { Media, apiAction } from '@shared/api';

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

/** One picture of a question: pick, compress, upload, preview, remove. */
@Component({
  selector: 'vq-question-image',
  imports: [VdButton, VdDropzone, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './question-image.scss',
  templateUrl: './question-image.html',
})
export class QuestionImage {
  readonly quizId = input.required<string>();
  readonly path = input.required<string | null>();
  readonly label = input.required<string>();
  readonly pathChange = output<string | null>();

  private readonly media = inject(Media);
  private readonly toaster = inject(VdToaster);

  protected readonly maxBytes = MAX_SOURCE_BYTES;
  private readonly action = apiAction();
  protected readonly uploading = this.action.busy;
  protected readonly src = computed(() => {
    const path = this.path();
    return path ? this.media.publicUrl(path) : null;
  });

  protected async upload(files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    await this.action.run(
      async () => this.pathChange.emit(await this.media.upload(this.quizId(), file)),
      { errorTitle: 'Не вдалося завантажити картинку' },
    );
  }

  protected reject(): void {
    this.toaster.error('Цей файл не підходить', 'Потрібна картинка до 30 МБ.');
  }
}
