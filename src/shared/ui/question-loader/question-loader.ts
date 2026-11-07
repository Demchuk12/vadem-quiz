import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The quiz's own "please wait": a board tile where a question mark writes itself and its dot
 * drops in. It fades in only after a short wait, so a fast load never flashes it.
 */
@Component({
  selector: 'vq-question-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './question-loader.scss',
  templateUrl: './question-loader.html',
  host: {
    role: 'status',
    '[attr.data-size]': 'size()',
  },
})
export class QuestionLoader {
  /** What is happening, in the host's words: under a large loader, beside a small one. */
  readonly label = input.required<string>();
  readonly size = input<'sm' | 'lg'>('lg');
}
