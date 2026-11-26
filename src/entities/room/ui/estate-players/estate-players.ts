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
import { ORNAMENTS } from '@shared/ui';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';
import { estatePlayers, isOwnable, tokenOf } from '../../lib/estate';
import type { Player } from '../../model/room';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';
import { EstateToken } from '../estate-token/estate-token';

/** The players of a "Господар" game in turn order: token, money, worth and what they hold. */
@Component({
  selector: 'vq-estate-players',
  imports: [EstateToken, VdBadge, VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-players.scss',
  templateUrl: './estate-players.html',
})
export class EstatePlayers {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);
  private readonly format = injectNumberFormat();
  readonly currentPlayerId = input<string | null>(null);
  /** Lets the host take a player out of the game. */
  readonly removable = input(false, { transform: booleanAttribute });
  readonly remove = output<Player>();
  /** A label for the remove button, from the page that offers it. */
  readonly removeLabel = input<(nickname: string) => string>((name) => name);

  protected money(amount: number | null): string {
    return `${this.format(amount ?? 0)} ₴`;
  }

  protected readonly rows = computed(() => {
    const turn = this.store.room()?.estate_turn;
    const cells = this.store.estateCells();
    const online = this.store.onlinePlayerIds();
    return estatePlayers(this.store.players()).map((player) => ({
      player,
      turn: player.id === turn,
      me: player.id === this.currentPlayerId(),
      offline: !online.has(player.id),
      chips: cells
        .filter((c) => c.owner_id === player.id && isOwnable(c))
        .map((c) => ({
          idx: c.idx,
          color: c.region === null ? null : (ORNAMENTS[c.region]?.color ?? null),
          mortgaged: c.mortgaged,
        })),
      token: this.t().estate.tokens[tokenOf(player).key],
    }));
  });
}
