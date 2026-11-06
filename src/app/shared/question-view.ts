import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { Media } from '../core/media';
import type { Room } from '../game/models';

/** The open question, and its answer once revealed. */
@Component({
  selector: 'vq-question-view',
  imports: [VdBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-4);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
      align-items: center;
    }
    .text {
      margin: 0;
      font-size: var(--vd-text-2xl);
      font-weight: var(--vd-weight-semibold);
      line-height: var(--vd-leading-snug);
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    :host([data-large]) .text {
      font-size: var(--vd-text-4xl);
    }
    img {
      display: block;
      max-inline-size: 100%;
      max-block-size: 50dvh;
      border-radius: var(--vd-radius-lg);
      object-fit: contain;
    }
    .answer {
      display: grid;
      gap: var(--vd-space-2);
      padding: var(--vd-space-4);
      border: var(--vd-border-width) solid var(--vd-color-success-border);
      border-radius: var(--vd-radius-lg);
      background-color: var(--vd-color-success-subtle);
    }
    .answer .text {
      font-size: var(--vd-text-xl);
    }
  `,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  template: `
    <div class="meta">
      @if (categoryTitle(); as title) {
        <span vdBadge>{{ title }}</span>
      }
      <span vdBadge variant="info">{{ room().current_points }} очок</span>
    </div>
    @if (room().question_text; as text) {
      <p class="text">{{ text }}</p>
    }
    @if (questionImage(); as src) {
      <img [src]="src" alt="Ілюстрація до питання" />
    }
    @if (room().state === 'answer_shown') {
      <div class="answer">
        <p class="vd-eyebrow">Правильна відповідь</p>
        @if (room().answer_text; as answer) {
          <p class="text">{{ answer }}</p>
        }
        @if (answerImage(); as src) {
          <img [src]="src" alt="Ілюстрація до відповіді" />
        }
      </div>
    }
  `,
})
export class QuestionView {
  readonly room = input.required<Room>();
  readonly categoryTitle = input<string | null>(null);
  readonly large = input(false, { transform: booleanAttribute });

  private readonly media = inject(Media);
  private readonly url = (path: string | null) => (path ? this.media.publicUrl(path) : null);

  protected readonly questionImage = computed(() => this.url(this.room().question_image_path));
  protected readonly answerImage = computed(() => this.url(this.room().answer_image_path));
}
