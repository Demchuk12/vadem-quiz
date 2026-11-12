import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { factStem } from '../../lib/bluff';
import { RoomStore } from '../../model/room-store';

/** The fact of the round: a blank where the ending goes, the truth there once revealed. */
@Component({
  selector: 'vq-bluff-fact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './bluff-fact.scss',
  templateUrl: './bluff-fact.html',
})
export class BluffFact {
  /** The stream's size, read from across a room. */
  readonly large = input(false, { transform: booleanAttribute });

  private readonly store = inject(RoomStore);

  protected readonly room = this.store.room;
  protected readonly stem = computed(() => factStem(this.room()?.question_text ?? ''));
}
