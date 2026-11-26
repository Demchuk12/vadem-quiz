import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { Ornament } from '@shared/ui';
import { ESTATE_HOUSE, ESTATE_ICONS, ESTATE_MANOR } from '../../config/estate-tokens';
import { estatePlace, tokenOf } from '../../lib/estate';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';
import { EstateToken } from '../estate-token/estate-token';

/**
 * The ring of "Господар" on a 9 × 9 grid, with owners, houses and tokens. What goes in the middle
 * is the page's. Sizes follow the board's width, so a page decides how large it is.
 */
@Component({
  selector: 'vq-estate-board',
  imports: [EstateToken, Ornament],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.interactive]': 'interactive()' },
  styleUrl: './estate-board.scss',
  templateUrl: './estate-board.html',
})
export class EstateBoard {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);
  private readonly format = injectNumberFormat();

  /** Cells can be picked: a page shows the picked one's card. */
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly selected = input<number | null>(null);
  readonly pick = output<number>();

  protected readonly house = ESTATE_HOUSE;
  protected readonly manor = ESTATE_MANOR;

  protected readonly cells = computed(() => {
    const players = this.store.players();
    const turn = this.store.room()?.estate_turn ?? null;
    const t = this.t().estate;
    return this.store.estateCells().map((cell) => {
      const owner = players.find((p) => p.id === cell.owner_id) ?? null;
      const here = players
        .filter((p) => p.position === cell.idx && p.turn_order !== null && !p.bankrupt)
        .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0));
      const price = cell.price > 0 ? `${this.format(cell.price)} ₴` : '';
      // The visible name and price come first; the rest only a screen reader needs.
      const details = [
        owner ? price : '',
        owner ? t.owner(owner.nickname) : '',
        cell.level ? t.houses(cell.level) : '',
        cell.mortgaged ? t.mortgaged : '',
        here.length ? t.here(here.map((p) => p.nickname).join(', ')) : '',
      ].filter(Boolean);
      return {
        cell,
        place: estatePlace(cell.idx),
        icon: cell.kind === 'city' ? null : ESTATE_ICONS[cell.kind as keyof typeof ESTATE_ICONS],
        price: owner ? '' : price,
        owner: owner ? { initial: owner.nickname.slice(0, 1), color: tokenOf(owner).color } : null,
        houses: cell.level === 4 ? ['manor'] : Array.from({ length: cell.level }, () => 'house'),
        here: here.map((p) => ({ player: p, current: p.id === turn })),
        turn: here.some((p) => p.id === turn),
        details: details.length ? `, ${details.join(', ')}` : '',
      };
    });
  });
}
