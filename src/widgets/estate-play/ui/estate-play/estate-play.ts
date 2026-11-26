import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  EstateBoard,
  EstateCard,
  EstateCenter,
  RoomApi,
  RoomStore,
  endPhaseOnTime,
  isOwnable,
  regionCells,
  rentOf,
  type EstateCell,
  type PlayerSession,
} from '@entities/room';
import { EstateAuction } from '@features/estate-auction';
import { EstateProperty } from '@features/estate-property';
import { EstateTrade } from '@features/estate-trade';
import { EstateTurn } from '@features/estate-turn';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { Ornament } from '@shared/ui';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VD_DIALOG } from '@vadem/ui/dialog';
import { VdIcon } from '@vadem/ui/icon';
import { VD_TABS } from '@vadem/ui/tabs';
import { MESSAGES } from '../../i18n/messages';

type Tab = 'board' | 'holdings' | 'trade';

/** Below this width the board starts close up, centred on the token whose turn it is. */
const NARROW = '(max-width: 47.99rem)';

/** A player's game of "Господар": the board, their holdings, trades and the turn. */
@Component({
  selector: 'vq-estate-play',
  imports: [
    EstateAuction,
    EstateBoard,
    EstateCard,
    EstateCenter,
    EstateProperty,
    EstateTrade,
    EstateTurn,
    Ornament,
    VdBadge,
    VdButton,
    VD_CARD,
    VD_DIALOG,
    VdIcon,
    VD_TABS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-play.scss',
  templateUrl: './estate-play.html',
})
export class EstatePlay {
  protected readonly t = injectMessages(MESSAGES);
  readonly session = input.required<PlayerSession>();

  protected readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly format = injectNumberFormat();

  protected readonly tab = signal<Tab>('board');
  protected readonly close = signal(globalThis.matchMedia?.(NARROW).matches ?? false);
  protected readonly selected = signal<number | null>(null);
  protected readonly selectedCell = computed(
    () => this.store.estateCells().find((c) => c.idx === this.selected()) ?? null,
  );
  protected readonly step = computed(() => this.store.room()?.estate_step ?? null);
  protected readonly myTurn = computed(
    () => this.store.room()?.estate_turn === this.session().playerId,
  );
  protected readonly offers = computed(
    () => this.store.estateOffers().filter((o) => o.to_id === this.session().playerId).length,
  );
  /** Where the token whose turn it is stands: the close-up follows it. */
  private readonly focus = computed(() => {
    const room = this.store.room();
    return this.store.players().find((p) => p.id === room?.estate_turn)?.position ?? null;
  });

  /** The player's land: cities by region, then stations and utilities. */
  protected readonly holdings = computed(() => {
    const cells = this.store.estateCells();
    const mine = cells.filter((c) => c.owner_id === this.session().playerId && isOwnable(c));
    const regions = [...new Set(mine.filter((c) => c.kind === 'city').map((c) => c.region))]
      .sort((a, b) => (a ?? 0) - (b ?? 0))
      .map((region) => {
        const all = regionCells(cells, region);
        const have = all.filter((c) => c.owner_id === this.session().playerId);
        return {
          region,
          name: this.store.room()?.estate_regions?.[region ?? 0] ?? '',
          count: this.t().region(have.length, all.length),
          whole: have.length === all.length,
          cells: have,
        };
      });
    const others = mine.filter((c) => c.kind !== 'city');
    return { regions, others, empty: mine.length === 0 };
  });

  constructor() {
    // Any page in the room may say a clock ran out; the database ignores a late second word.
    endPhaseOnTime(['estate_playing'], () =>
      this.api.estateTimeout(this.session().roomId, this.session().token),
    );
    afterRenderEffect(() => {
      const idx = this.focus();
      if (!this.close() || idx === null || this.tab() !== 'board') return;
      this.scrollTo(idx);
    });
  }

  protected rent(cell: EstateCell): string {
    const rent = rentOf(this.store.estateCells(), cell);
    if (cell.mortgaged) return this.t().mortgaged;
    const amount = `${this.format(rent)} ₴`;
    return cell.kind === 'utility' ? this.t().perPoint(amount) : this.t().rentNow(amount);
  }

  protected toToken(): void {
    const idx = this.focus();
    if (idx !== null) this.scrollTo(idx);
  }

  /** Scrolls the board's own box, never the page, so the cell sits in the middle of it. */
  private scrollTo(idx: number): void {
    const root = this.host.nativeElement as HTMLElement;
    const viewport = root.querySelector<HTMLElement>('.viewport');
    const cell = root.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (!viewport || !cell) return;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      left: cell.offsetLeft - (viewport.clientWidth - cell.offsetWidth) / 2,
      top: cell.offsetTop - (viewport.clientHeight - cell.offsetHeight) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }
}
