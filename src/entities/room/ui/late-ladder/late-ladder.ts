import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { formatDelay, lateLadder } from '../../lib/game-logic';
import { RoomStore } from '../../model/room-store';

/** Who pressed after the winner and how close they came, while the winner answers. */
@Component({
  selector: 'vq-late-ladder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './late-ladder.scss',
  templateUrl: './late-ladder.html',
  host: { '[attr.data-large]': 'large() ? "" : null' },
})
export class LateLadder {
  /** For a shared screen. */
  readonly large = input(false, { transform: booleanAttribute });

  private readonly store = inject(RoomStore);
  protected readonly ladder = computed(() => {
    const room = this.store.room();
    return room ? lateLadder(room, this.store.players()) : [];
  });
  protected readonly format = formatDelay;
}
