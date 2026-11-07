import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { Media } from '@shared/api';
import { RoomStore } from '../../model/room-store';

/** The open question, and its answer once revealed. */
@Component({
  selector: 'vq-question-view',
  imports: [VdBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './question-view.scss',
  host: { '[attr.data-large]': 'large() ? "" : null' },
  templateUrl: './question-view.html',
})
export class QuestionView {
  /** For a shared screen. */
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly store = inject(RoomStore);
  private readonly media = inject(Media);

  private url(path: string | null | undefined): string | null {
    return path ? this.media.publicUrl(path) : null;
  }

  protected readonly questionImage = computed(() =>
    this.url(this.store.room()?.question_image_path),
  );
  protected readonly answerImage = computed(() => this.url(this.store.room()?.answer_image_path));
}
