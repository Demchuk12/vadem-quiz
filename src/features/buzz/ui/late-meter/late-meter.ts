import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatDelay } from '@entities/room';

const COUNT_MS = 650;
/** Under this, the player nearly had it. */
const CLOSE_MS = 100;

/**
 * A stopwatch for the player who pressed too late: it runs from zero up to how late they were,
 * by the server's clock. Under reduced motion it shows the result at once.
 */
@Component({
  selector: 'vq-late-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './late-meter.scss',
  templateUrl: './late-meter.html',
})
export class LateMeter {
  /** Milliseconds after the winning press. */
  readonly ms = input.required<number>();

  protected readonly shown = signal(0);
  protected readonly close = computed(() => this.ms() < CLOSE_MS);
  protected readonly text = computed(() => formatDelay(this.shown()));
  protected readonly final = computed(() => formatDelay(this.ms()));
  /** How full the ring is, from 0 to 1, a second being a full turn. */
  protected readonly fill = computed(() => Math.min(1, this.shown() / 1000));

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    effect((onCleanup) => {
      const target = this.ms();
      if (!view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.shown.set(target);
        return;
      }
      const start = view.performance.now();
      let frame = 0;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / COUNT_MS);
        // Fast at first, settling on the value, like a stopwatch being stopped.
        this.shown.set(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = view.requestAnimationFrame(tick);
      };
      frame = view.requestAnimationFrame(tick);
      onCleanup(() => view.cancelAnimationFrame(frame));
    });
  }
}
