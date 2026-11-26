import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  EstateDice,
  PhaseTimer,
  RoomApi,
  RoomStore,
  turnPlayer,
  type PlayerSession,
} from '@entities/room';
import { apiAction } from '@shared/api';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

type TurnAction = 'roll' | 'pay_bail' | 'buy' | 'decline' | 'end_turn' | 'pay_debt';

/** The turn as this player sees it: the dice, where they stand and what they may do next. */
@Component({
  selector: 'vq-estate-turn',
  imports: [EstateDice, PhaseTimer, VdAlertDialog, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-turn.scss',
  templateUrl: './estate-turn.html',
})
export class EstateTurn {
  protected readonly t = injectMessages(MESSAGES);
  readonly session = input.required<PlayerSession>();

  protected readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();
  private readonly format = injectNumberFormat();
  protected readonly busy = this.action.busy;

  protected money(amount: number): string {
    return `${this.format(amount)} ₴`;
  }

  protected readonly me = computed(
    () => this.store.players().find((p) => p.id === this.session().playerId) ?? null,
  );
  protected readonly turn = computed(() => turnPlayer(this.store.room(), this.store.players()));
  protected readonly mine = computed(() => this.turn()?.id === this.session().playerId);
  protected readonly step = computed(() => this.store.room()?.estate_step ?? null);
  protected readonly cell = computed(() => {
    const position = this.turn()?.position;
    return this.store.estateCells().find((c) => c.idx === position) ?? null;
  });
  protected readonly debt = computed(() =>
    (this.store.room()?.estate_debts ?? []).reduce((sum, d) => sum + d.amount, 0),
  );
  /** A double: the step is a throw again although the dice are on the table. */
  protected readonly again = computed(() => {
    const dice = this.store.room()?.estate_dice;
    return !!dice && dice[0] === dice[1] && this.me()?.cnap_tries === null;
  });

  protected readonly confirming = signal(false);

  protected act(action: TurnAction): void {
    void this.action.run(() => this.api.estate(action, this.session()));
  }

  /** The dialog shows a failure itself. */
  protected readonly giveUp = async (): Promise<void> => {
    await this.api.estate('give_up', this.session());
    this.confirming.set(false);
  };
}
