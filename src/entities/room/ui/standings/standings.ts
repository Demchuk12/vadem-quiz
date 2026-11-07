import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  effect,
  untracked,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VdEmptyState, VdEmptyStateTitle } from '@vadem/ui/empty-state';
import { VdIcon } from '@vadem/ui/icon';
import { VD_LEADERBOARD, type VdLeaderboardChange } from '@vadem/ui/leaderboard';
import { formatScore } from '../../lib/game-logic';
import type { Player } from '../../model/room';
import { RoomStore } from '../../model/room-store';

const REORDER_MOTION: KeyframeAnimationOptions = {
  duration: 300,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

@Component({
  selector: 'vq-standings',
  imports: [VD_LEADERBOARD, VdBadge, VdButton, VdIcon, VdEmptyState, VdEmptyStateTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './standings.html',
})
export class Standings {
  /** The row of the person looking at the screen. */
  readonly currentPlayerId = input<string | null>(null);
  /** Marks who is offline. Only meaningful while players report their presence. */
  readonly showOnline = input(false, { transform: booleanAttribute });
  /** For the host: adds a correction button to each row. */
  readonly editable = input(false, { transform: booleanAttribute });
  readonly adjust = output<Player>();

  protected readonly store = inject(RoomStore);
  protected readonly format = formatScore;

  /** The latest change of each player's score, shown once beside it. */
  protected readonly changes = signal<ReadonlyMap<string, VdLeaderboardChange>>(new Map());

  constructor() {
    this.animateReordering();
    this.trackChanges();
  }

  /** Every score change, a verdict or the host's correction, rises from the score once. */
  private trackChanges(): void {
    let previous: Map<string, number> | null = null;
    effect(() => {
      const players = this.store.players();
      const scores = new Map(players.map((player) => [player.id, player.score]));
      if (previous) {
        const changed = new Map(untracked(this.changes));
        for (const [id, score] of scores) {
          const before = previous.get(id);
          if (before === undefined || before === score) continue;
          const delta = score - before;
          changed.set(id, {
            label: delta > 0 ? `+${formatScore(delta)}` : formatScore(delta),
            tone: delta > 0 ? 'gain' : 'loss',
          });
        }
        this.changes.set(changed);
      }
      previous = scores;
    });
  }

  /** A row that changed places slides there, so the room sees who overtook whom. */
  private animateReordering(): void {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const view = inject(DOCUMENT).defaultView;
    const previousTops = new Map<string, number>();

    afterRenderEffect(() => {
      this.store.ranked();
      const animate = !view?.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const row of host.querySelectorAll<HTMLElement>('[data-player-id]')) {
        const id = row.dataset['playerId']!;
        const top = row.offsetTop;
        const previous = previousTops.get(id);
        if (animate && previous !== undefined && previous !== top) {
          row.animate(
            [{ translate: `0 ${previous - top}px` }, { translate: '0 0' }],
            REORDER_MOTION,
          );
        }
        previousTops.set(id, top);
      }
    });
  }

  protected isOffline(player: Player): boolean {
    return this.showOnline() && !this.store.onlinePlayerIds().has(player.id);
  }
}
