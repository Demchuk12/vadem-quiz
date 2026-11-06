import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VdEmptyState, VdEmptyStateTitle } from '@vadem/ui/empty-state';
import { VdIcon } from '@vadem/ui/icon';
import { VD_LEADERBOARD } from '@vadem/ui/leaderboard';
import { formatScore, type RankedPlayer } from '../game/game-logic';
import type { Player } from '../game/models';

@Component({
  selector: 'vq-standings',
  imports: [VD_LEADERBOARD, VdBadge, VdButton, VdIcon, VdEmptyState, VdEmptyStateTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ranked().length === 0) {
      <div vdEmptyState icon="users" size="sm">
        <p vdEmptyStateTitle>Гравців ще немає</p>
      </div>
    } @else {
      <ol vdLeaderboard aria-label="Таблиця лідерів">
        @for (entry of ranked(); track entry.player.id) {
          <li
            vdLeaderboardRow
            [rank]="entry.rank"
            [name]="entry.player.nickname"
            [score]="format(entry.player.score)"
            [negative]="entry.player.score < 0"
            [current]="entry.player.id === currentPlayerId()"
            [inactive]="isOffline(entry.player)"
          >
            @if (isOffline(entry.player)) {
              <span vdBadge>Офлайн</span>
            }
            @if (editable()) {
              <button
                slot="actions"
                vdButton
                variant="ghost"
                size="sm"
                iconOnly
                [attr.aria-label]="'Змінити очки: ' + entry.player.nickname"
                (click)="adjust.emit(entry.player)"
              >
                <vd-icon name="pencil" />
              </button>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class Standings {
  readonly ranked = input.required<RankedPlayer[]>();
  readonly currentPlayerId = input<string | null>(null);
  /** Null when this view does not track who is online. */
  readonly onlineIds = input<ReadonlySet<string> | null>(null);
  readonly editable = input(false, { transform: booleanAttribute });
  readonly adjust = output<Player>();

  protected readonly format = formatScore;

  protected isOffline(player: Player): boolean {
    const online = this.onlineIds();
    return online !== null && !online.has(player.id);
  }
}
