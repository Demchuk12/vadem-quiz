import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  input,
} from '@angular/core';
import { tokenOf } from '../../lib/estate';
import type { Player } from '../../model/room';

/** A player's token: its drawing on the player's colour. Decoration; the name says who it is. */
@Component({
  selector: 'vq-estate-token',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--vq-token-color]': 'look().color',
    '[class.current]': 'current()',
  },
  styleUrl: './estate-token.scss',
  templateUrl: './estate-token.html',
})
export class EstateToken {
  readonly player = input.required<Pick<Player, 'turn_order'>>();
  /** Ringed: the player whose turn it is. */
  readonly current = input(false, { transform: booleanAttribute });

  protected readonly look = computed(() => tokenOf(this.player()));
}
