import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ORNAMENTS, THREAD } from './ornaments';

let nextId = 0;

/** A band of a region's embroidery, filling the box it is given. Decoration only. */
@Component({
  selector: 'vq-ornament',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styleUrl: './ornament.scss',
  templateUrl: './ornament.html',
})
export class Ornament {
  /** The region, 0 to 7. */
  readonly region = input.required<number>();

  protected readonly id = `vq-ornament-${nextId++}`;
  protected readonly thread = THREAD;
  protected readonly look = computed(() => ORNAMENTS[this.region() % ORNAMENTS.length]);
}
