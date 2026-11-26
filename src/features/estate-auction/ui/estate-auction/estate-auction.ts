import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PhaseTimer, RoomApi, RoomStore, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

/** Steps a bid can rise by; the database wants 10 at least. */
const RAISES = [10, 100, 500] as const;

/** Land nobody bought, for anyone still in the game to bid on. */
@Component({
  selector: 'vq-estate-auction',
  imports: [PhaseTimer, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-auction.scss',
  templateUrl: './estate-auction.html',
})
export class EstateAuction {
  protected readonly t = injectMessages(MESSAGES);
  /** Null for a page that only watches. */
  readonly session = input<PlayerSession | null>(null);

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();
  private readonly format = injectNumberFormat();
  protected readonly busy = this.action.busy;

  protected money(amount: number): string {
    return `${this.format(amount)} ₴`;
  }

  protected readonly auction = computed(() => this.store.room()?.estate_auction ?? null);
  protected readonly cell = computed(() =>
    this.store.estateCells().find((c) => c.idx === this.auction()?.cell),
  );
  protected readonly leader = computed(() =>
    this.store.players().find((p) => p.id === this.auction()?.leader),
  );
  protected readonly me = computed(() =>
    this.store.players().find((p) => p.id === this.session()?.playerId),
  );
  protected readonly canBid = computed(() => {
    const me = this.me();
    return !!me && !me.bankrupt && me.turn_order !== null && this.leader()?.id !== me.id;
  });
  protected readonly bids = computed(() => {
    const bid = this.auction()?.bid ?? 0;
    const money = this.me()?.money ?? 0;
    return RAISES.map((raise) => ({
      raise,
      amount: bid + raise,
      affordable: bid + raise <= money,
    }));
  });

  protected bid(amount: number): void {
    const session = this.session();
    if (session) void this.action.run(() => this.api.estateBid(session, amount));
  }
}
