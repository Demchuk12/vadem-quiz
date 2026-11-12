import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { secondsLeft } from '../../lib/bluff';
import { RoomStore } from '../../model/room-store';

/** The countdown of the current "Варіанти" phase. Hidden when the phase has no clock. */
@Component({
  selector: 'vq-phase-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './phase-timer.scss',
  templateUrl: './phase-timer.html',
})
export class PhaseTimer {
  private readonly store = inject(RoomStore);
  private readonly now = signal(Date.now());

  protected readonly left = computed(() => secondsLeft(this.store.phaseEndsAt(), this.now()));
  protected readonly running = computed(() => this.store.phaseEndsAt() !== null);

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
