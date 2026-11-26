import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  RoomApi,
  RoomStore,
  estatePlayers,
  isOwnable,
  type EstateCell,
  type EstateOffer,
  type PlayerSession,
} from '@entities/room';
import { apiAction } from '@shared/api';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdCheckbox } from '@vadem/ui/checkbox';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';
import { VdOption, VdSelect } from '@vadem/ui/select';
import { MESSAGES } from '../../i18n/messages';

/** Deals between players: offers to this player, their own open offer and a new one. */
@Component({
  selector: 'vq-estate-trade',
  imports: [VdButton, VD_CARD, VdCheckbox, VdField, VdInput, VdOption, VdSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-trade.scss',
  templateUrl: './estate-trade.html',
})
export class EstateTrade {
  protected readonly t = injectMessages(MESSAGES);
  readonly session = input.required<PlayerSession>();

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();
  private readonly format = injectNumberFormat();
  protected readonly busy = this.action.busy;

  protected readonly partner = signal<string | null>(null);
  protected readonly give = signal<ReadonlySet<number>>(new Set());
  protected readonly get = signal<ReadonlySet<number>>(new Set());
  protected readonly giveMoney = signal(0);
  protected readonly getMoney = signal(0);

  private readonly me = computed(() => this.session().playerId);
  protected readonly others = computed(() =>
    estatePlayers(this.store.players()).filter((p) => p.id !== this.me() && !p.bankrupt),
  );
  protected readonly incoming = computed(() =>
    this.store.estateOffers().filter((o) => o.to_id === this.me()),
  );
  protected readonly mine = computed(
    () => this.store.estateOffers().find((o) => o.from_id === this.me()) ?? null,
  );
  protected readonly myLand = computed(() => this.tradable(this.me()));
  protected readonly theirLand = computed(() => {
    const partner = this.partner();
    return partner ? this.tradable(partner) : [];
  });
  protected readonly ready = computed(
    () =>
      !!this.partner() &&
      this.give().size + this.get().size + this.giveMoney() + this.getMoney() > 0,
  );

  protected nameOf(id: string): string {
    return this.store.players().find((p) => p.id === id)?.nickname ?? '';
  }

  /** The cells and money of one side of a deal, in words. */
  protected side(cells: number[], money: number): string {
    const names = cells.map(
      (idx) => this.store.estateCells().find((c) => c.idx === idx)?.name ?? '',
    );
    if (money > 0) names.push(`${this.format(money)} ₴`);
    return names.length ? names.join(', ') : this.t().nothing;
  }

  protected choose(id: string): void {
    this.partner.set(id || null);
    this.get.set(new Set());
  }

  protected toggle(which: 'give' | 'get', idx: number, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this[which].update((set) => {
      const next = new Set(set);
      if (on) next.add(idx);
      else next.delete(idx);
      return next;
    });
  }

  protected setMoney(which: 'giveMoney' | 'getMoney', event: Event): void {
    const value = Math.max(0, Math.round(Number((event.target as HTMLInputElement).value)));
    this[which].set(Number.isFinite(value) ? value : 0);
  }

  protected async send(): Promise<void> {
    const to = this.partner();
    if (!to) return;
    const done = await this.action.run(() =>
      this.api.estateOffer(this.session(), {
        to,
        giveCells: [...this.give()],
        getCells: [...this.get()],
        giveMoney: this.giveMoney(),
        getMoney: this.getMoney(),
      }),
    );
    if (done) {
      this.give.set(new Set());
      this.get.set(new Set());
      this.giveMoney.set(0);
      this.getMoney.set(0);
    }
  }

  protected answer(offer: EstateOffer, accept: boolean): void {
    void this.action.run(() => this.api.estateAnswer(this.session(), offer.id, accept));
  }

  protected cancel(): void {
    void this.action.run(() => this.api.estate('cancel_offer', this.session()));
  }

  /** A player's land that may change hands: nothing of a region with houses. */
  private tradable(playerId: string): EstateCell[] {
    const cells = this.store.estateCells();
    const built = new Set(cells.filter((c) => c.level > 0).map((c) => c.region));
    return cells.filter(
      (c) => c.owner_id === playerId && isOwnable(c) && !(c.kind === 'city' && built.has(c.region)),
    );
  }
}
