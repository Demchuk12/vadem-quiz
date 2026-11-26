import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { tokenOf } from '../../lib/estate';
import type { EstateEvent } from '../../model/room';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

/** The latest events of a "Господар" game, newest first, in this screen's language. */
@Component({
  selector: 'vq-estate-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-log.scss',
  templateUrl: './estate-log.html',
})
export class EstateLog {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);
  private readonly format = injectNumberFormat();
  /** How many events to show. */
  readonly limit = input(6);

  protected readonly lines = computed(() =>
    this.store
      .estateEvents()
      .slice(-this.limit())
      .reverse()
      .map((event) => {
        const player = this.store.players().find((p) => p.id === event.player_id);
        return {
          id: event.id,
          color: player ? tokenOf(player).color : null,
          text: this.describe(event),
        };
      })
      .filter((line) => line.text),
  );

  private describe(event: EstateEvent): string {
    const e = this.t().estate.events;
    const data = event.data;
    const name = (id: unknown) => this.store.players().find((p) => p.id === id)?.nickname ?? '—';
    const cell = (idx: unknown) => this.store.estateCells().find((c) => c.idx === idx)?.name ?? '';
    const money = (amount: unknown) => `${this.format(Number(amount))} ₴`;
    const who = name(event.player_id);
    switch (event.code) {
      case 'start':
        return e.start();
      case 'roll': {
        const [a, b] = (data['dice'] as number[] | undefined) ?? [];
        return e.roll(who, a ?? 0, b ?? 0);
      }
      case 'salary':
        return e.salary(who, money(data['amount']));
      case 'buy':
        return e.buy(who, cell(data['cell']), money(data['amount']));
      case 'auction':
        return e.auction(cell(data['cell']));
      case 'auction_won':
        return e.auctionWon(who, cell(data['cell']), money(data['amount']));
      case 'auction_none':
        return e.auctionNone(cell(data['cell']));
      case 'rent':
        return e.rent(who, name(data['to']), money(data['amount']), cell(data['cell']));
      case 'tax':
        return e.tax(who, money(data['amount']));
      case 'card':
        return e.card(who, String(data['text'] ?? ''));
      case 'cnap_in':
        return e.cnapIn(who);
      case 'cnap_out': {
        const how = data['how'] as keyof typeof e.cnapOut;
        return (e.cnapOut[how] ?? e.cnapOut.double)(who);
      }
      case 'debt_paid':
        return e.debtPaid(who);
      case 'bankrupt':
        return e.bankrupt(who, data['to'] ? name(data['to']) : null);
      case 'build':
        return e.build(who, cell(data['cell']), data['level'] === 4);
      case 'sell':
        return e.sell(who, cell(data['cell']));
      case 'mortgage':
        return e.mortgage(who, cell(data['cell']));
      case 'redeem':
        return e.redeem(who, cell(data['cell']));
      case 'offer':
        return e.offer(who, name(data['to']));
      case 'offer_declined':
        return e.offerDeclined(who, name(data['from']));
      case 'trade':
        return e.trade(who, name(data['to']));
      case 'finished':
        return e.finished(who);
      default:
        return '';
    }
  }
}
