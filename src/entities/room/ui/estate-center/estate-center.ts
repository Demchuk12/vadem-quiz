import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { turnPlayer } from '../../lib/estate';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';
import { EstateDice } from '../estate-dice/estate-dice';
import { EstateLog } from '../estate-log/estate-log';
import { EstateToken } from '../estate-token/estate-token';
import { PhaseTimer } from '../phase-timer/phase-timer';

/** The middle of the board: the game's name, the dice, whose turn it is and what just happened. */
@Component({
  selector: 'vq-estate-center',
  imports: [EstateDice, EstateLog, EstateToken, PhaseTimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.large]': 'large()' },
  styleUrl: './estate-center.scss',
  templateUrl: './estate-center.html',
})
export class EstateCenter {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly store = inject(RoomStore);
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly turn = computed(() => turnPlayer(this.store.room(), this.store.players()));
  protected readonly auctionCell = computed(() => {
    const auction = this.store.room()?.estate_auction;
    return auction ? this.store.estateCells().find((c) => c.idx === auction.cell) : undefined;
  });
}
