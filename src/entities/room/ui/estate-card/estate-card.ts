import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { Ornament } from '@shared/ui';
import { ESTATE_ICONS } from '../../config/estate-tokens';
import { isOwnable, ownsRegion, tokenOf } from '../../lib/estate';
import type { EstateCell } from '../../model/room';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

interface CardRow {
  label: string;
  value: string;
  /** The row that applies now. */
  current: boolean;
}

/** A cell's card: what it costs, what it earns and whose it is. Free cells say what they do. */
@Component({
  selector: 'vq-estate-card',
  imports: [Ornament],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-card.scss',
  templateUrl: './estate-card.html',
})
export class EstateCard {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);
  private readonly format = injectNumberFormat();
  readonly cell = input.required<EstateCell>();

  protected money(amount: number): string {
    return `${this.format(amount)} ₴`;
  }

  protected readonly ownable = computed(() => isOwnable(this.cell()));
  protected readonly icon = computed(() =>
    this.cell().kind === 'city'
      ? null
      : ESTATE_ICONS[this.cell().kind as keyof typeof ESTATE_ICONS],
  );
  protected readonly kicker = computed(() => {
    const cell = this.cell();
    const region = cell.region === null ? null : this.store.room()?.estate_regions?.[cell.region];
    return region ?? this.t().estate.kinds[cell.kind];
  });
  protected readonly about = computed(() => this.t().estate.about[this.cell().kind] ?? '');
  protected readonly owner = computed(() => {
    const owner = this.store.players().find((p) => p.id === this.cell().owner_id);
    return owner ? { nickname: owner.nickname, color: tokenOf(owner).color } : null;
  });

  protected readonly rows = computed<CardRow[]>(() => {
    const cell = this.cell();
    const cells = this.store.estateCells();
    const t = this.t().estate;
    if (cell.kind === 'city') {
      const whole = ownsRegion(cells, cell);
      return (cell.rents ?? []).map((rent, level) => ({
        label: t.rents[level] ?? '',
        value: this.money(level === 0 && whole ? rent * 2 : rent),
        current: cell.owner_id !== null && !cell.mortgaged && cell.level === level,
      }));
    }
    const count = cells.filter((c) => c.kind === cell.kind && c.owner_id === cell.owner_id).length;
    if (cell.kind === 'station') {
      return [250, 500, 1000, 2000].map((rent, i) => ({
        label: t.stations[i] ?? '',
        value: this.money(rent),
        current: cell.owner_id !== null && !cell.mortgaged && count === i + 1,
      }));
    }
    if (cell.kind === 'utility') {
      return [40, 100].map((rent, i) => ({
        label: t.utilities[i] ?? '',
        value: t.perPoint(this.money(rent)),
        current: cell.owner_id !== null && !cell.mortgaged && Math.min(count, 2) === i + 1,
      }));
    }
    return [];
  });

  protected readonly foot = computed(() => {
    const cell = this.cell();
    const t = this.t().estate;
    const loan = this.money(cell.price / 2);
    if (cell.kind === 'city')
      return `${t.houseCost(this.money(cell.house_cost), loan)} ${t.regionBonus}`;
    return this.ownable() ? t.loan(loan) : '';
  });
}
