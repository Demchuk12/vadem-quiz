import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

/** Who is done with the current phase: each player as a chip, done ones lit. */
@Component({
  selector: 'vq-phase-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './phase-progress.scss',
  templateUrl: './phase-progress.html',
})
export class PhaseProgress {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);

  protected readonly players = computed(() => {
    const done = new Set(this.store.room()?.bluff_done ?? []);
    return this.store.players().map((player) => ({ player, done: done.has(player.id) }));
  });
  protected readonly summary = computed(() => {
    const { voted, wrote } = this.t().progress;
    const done = this.players().filter((entry) => entry.done).length;
    const say = this.store.room()?.state === 'bluff_voting' ? voted : wrote;
    return say(done, this.players().length);
  });
}
