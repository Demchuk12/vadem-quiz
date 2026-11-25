import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import {
  BluffFact,
  PhaseProgress,
  BluffReveal,
  HostSession,
  PhaseTimer,
  RoomApi,
  RoomStore,
  endPhaseOnTime,
  type BluffHostFact,
} from '@entities/room';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

/**
 * The host's view of a "Варіанти" round: the fact with its truth and decoy, who is done, and the
 * step to the next phase. With no server of our own, this page ends a phase when its clock runs
 * out; the players' last submission ends it sooner.
 */
@Component({
  selector: 'vq-host-bluff-panel',
  imports: [BluffFact, PhaseProgress, BluffReveal, PhaseTimer, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host-bluff-panel.scss',
  templateUrl: './host-bluff-panel.html',
})
export class HostBluffPanel {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly store = inject(RoomStore);
  /** Only a new fact resets the round's state, not every update of the room. */
  private readonly round = computed(() => this.store.room()?.round);
  protected readonly host = inject(HostSession);
  private readonly api = inject(RoomApi);

  protected readonly fact = signal<BluffHostFact | null>(null);
  protected readonly last = computed(() => {
    const room = this.store.room();
    return !!room && room.round >= room.round_count;
  });

  constructor() {
    // The truth and the decoy of each new fact, for the host's eyes.
    effect(() => {
      const round = this.round();
      if (round === undefined) return;
      untracked(() => {
        this.fact.set(null);
        void this.api
          .bluffHostFact(this.host.key)
          .then((fact) => this.fact.set(fact))
          .catch(() => undefined);
      });
    });

    endPhaseOnTime(['bluff_writing', 'bluff_voting'], (state) => this.step(state));
  }

  /** The host's button: the step from the current phase to the next one. */
  protected next(): void {
    const state = this.store.room()?.state;
    if (state) void this.host.act(() => this.step(state));
  }

  private step(state: string): Promise<void> {
    const key = this.host.key;
    if (state === 'bluff_writing') return this.api.bluffOpenVoting(key);
    if (state === 'bluff_voting') return this.api.bluffReveal(key);
    return this.api.bluffNext(key);
  }
}
