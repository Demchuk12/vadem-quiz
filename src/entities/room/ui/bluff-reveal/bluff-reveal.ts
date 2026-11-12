import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { revealOrder } from '../../lib/bluff';
import { RoomStore } from '../../model/room-store';

/**
 * The options of the round. While voting, only their words; at the reveal, one after another:
 * whose each was and who fell for it, the truth last.
 */
@Component({
  selector: 'vq-bluff-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './bluff-reveal.scss',
  templateUrl: './bluff-reveal.html',
})
export class BluffReveal {
  readonly large = input(false, { transform: booleanAttribute });

  private readonly store = inject(RoomStore);

  protected readonly revealed = computed(() => this.store.room()?.state === 'bluff_reveal');
  protected readonly options = computed(() => {
    const room = this.store.room();
    if (!room) return [];
    return this.revealed()
      ? revealOrder(room, this.store.players())
      : (room.bluff_options ?? []).map((option) => ({ option, label: '', voters: [] }));
  });
}
