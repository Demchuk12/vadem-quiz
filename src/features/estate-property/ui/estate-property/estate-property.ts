import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import {
  RoomApi,
  RoomStore,
  propertyMoves,
  redeemCost,
  type EstateCell,
  type PlayerSession,
} from '@entities/room';
import { apiAction } from '@shared/api';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

/** Building, selling, mortgaging and redeeming a player's own land, when the turn allows it. */
@Component({
  selector: 'vq-estate-property',
  imports: [VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-property.scss',
  templateUrl: './estate-property.html',
})
export class EstateProperty {
  protected readonly t = injectMessages(MESSAGES);
  readonly session = input.required<PlayerSession>();
  readonly cell = input.required<EstateCell>();
  /** Says when nothing can be done because it is not this player's turn. */
  readonly hint = input(true, { transform: booleanAttribute });

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();
  private readonly format = injectNumberFormat();
  protected readonly busy = this.action.busy;

  protected money(amount: number): string {
    return `${this.format(amount)} ₴`;
  }

  protected readonly mine = computed(() => this.cell().owner_id === this.session().playerId);
  /** Steps of their own turn in which the database lets a player change their land. */
  private readonly step = computed(() => {
    const room = this.store.room();
    return room?.estate_turn === this.session().playerId ? room.estate_step : null;
  });
  protected readonly moves = computed(() => {
    const money = this.store.players().find((p) => p.id === this.session().playerId)?.money ?? 0;
    const moves = propertyMoves(
      this.store.estateCells(),
      this.cell(),
      this.session().playerId,
      money,
    );
    const step = this.step();
    const turn = step === 'roll' || step === 'act';
    return {
      build: moves.build && turn,
      sell: moves.sell && (turn || step === 'debt'),
      mortgage: moves.mortgage && (turn || step === 'debt'),
      redeem: moves.redeem && turn,
    };
  });
  protected readonly myTurn = computed(() => this.step() !== null);
  protected readonly redeemCost = computed(() => redeemCost(this.cell()));

  protected run(action: 'build' | 'sell_house' | 'mortgage' | 'redeem'): void {
    void this.action.run(() => this.api.estateProperty(action, this.session(), this.cell().idx));
  }
}
