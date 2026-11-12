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

  protected readonly left = computed(() => {
    const room = this.store.room();
    return room ? secondsLeft(room, this.now()) : 0;
  });
  protected readonly running = computed(() => !!this.store.room()?.phase_ends_at);

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
