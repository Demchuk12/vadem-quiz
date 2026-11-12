import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RoomStore } from '../../model/room-store';

/** Who has written, or voted, so far: each player as a chip, done ones lit. */
@Component({
  selector: 'vq-bluff-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-progress.scss',
  templateUrl: './bluff-progress.html',
})
export class BluffProgress {
  private readonly store = inject(RoomStore);

  protected readonly verb = computed(() =>
    this.store.room()?.state === 'bluff_voting' ? 'Проголосували' : 'Написали',
  );
  protected readonly players = computed(() => {
    const done = new Set(this.store.room()?.bluff_done ?? []);
    return this.store.players().map((player) => ({ player, done: done.has(player.id) }));
  });
  protected readonly count = computed(() => this.players().filter((entry) => entry.done).length);
}
