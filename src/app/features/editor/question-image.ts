import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { VdButton } from '@vadem/ui/button';
import { VdDropzone } from '@vadem/ui/dropzone';
import { VdIcon } from '@vadem/ui/icon';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage } from '../../core/api-error';
import { Media } from '../../core/media';

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

/** One picture of a question: pick, compress, upload, preview, remove. */
@Component({
  selector: 'vq-question-image',
  imports: [VdButton, VdDropzone, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-3);
      align-items: center;
    }
    img {
      max-inline-size: 10rem;
      max-block-size: 7rem;
      border-radius: var(--vd-radius-md);
    }
  `,
  template: `
    @if (src(); as url) {
      <div class="preview">
        <img [src]="url" [alt]="label()" />
        <button vdButton size="sm" variant="ghost" (click)="pathChange.emit(null)">
          <vd-icon slot="start" name="trash" />
          Прибрати картинку
        </button>
      </div>
    } @else {
      <label
        vdDropzone
        [maxSize]="maxBytes"
        (filesSelected)="upload($event)"
        (filesRejected)="reject()"
      >
        <input type="file" accept="image/*" [attr.aria-label]="label()" [disabled]="uploading()" />
        <vd-icon name="upload" />
        <strong>{{ uploading() ? 'Завантажуємо…' : label() }}</strong>
        <span>Стиснемо до WebP, 1280 px</span>
      </label>
    }
  `,
})
export class QuestionImage {
  readonly quizId = input.required<string>();
  readonly path = input.required<string | null>();
  readonly label = input.required<string>();
  readonly pathChange = output<string | null>();

  private readonly media = inject(Media);
  private readonly toaster = inject(VdToaster);

  protected readonly maxBytes = MAX_SOURCE_BYTES;
  protected readonly uploading = signal(false);
  protected readonly src = computed(() => {
    const path = this.path();
    return path ? this.media.publicUrl(path) : null;
  });

  protected async upload(files: File[]): Promise<void> {
    const file = files[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      this.pathChange.emit(await this.media.upload(this.quizId(), file));
    } catch (error) {
      this.toaster.error('Не вдалося завантажити картинку', errorMessage(error));
    } finally {
      this.uploading.set(false);
    }
  }

  protected reject(): void {
    this.toaster.error('Цей файл не підходить', 'Потрібна картинка до 30 МБ.');
  }
}
