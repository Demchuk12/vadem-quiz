import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatScore } from '../../lib/game-logic';
import { RoomStore } from '../../model/room-store';

/** Who won. With shared first place it names the first in the standings. */
const BLOCK_COUNT = 18;
const BURST_RADIUS_REM = 14;

/** Blocks flying out evenly in all directions, at a few distances so the ring does not look drawn. */
const BLOCKS = Array.from({ length: BLOCK_COUNT }, (_, index) => {
  const angle = (index / BLOCK_COUNT) * 2 * Math.PI;
  const distance = BURST_RADIUS_REM * (0.6 + (index % 3) * 0.2);
  return {
    x: `${(Math.cos(angle) * distance).toFixed(2)}rem`,
    y: `${(Math.sin(angle) * distance * 0.6).toFixed(2)}rem`,
    delay: `${(index % 4) * 40}ms`,
  };
});

@Component({
  selector: 'vq-winner-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './winner-banner.scss',
  templateUrl: './winner-banner.html',
})
export class WinnerBanner {
  private readonly store = inject(RoomStore);

  protected readonly winner = computed(() => this.store.ranked()[0]?.player ?? null);
  protected readonly format = formatScore;
  protected readonly blocks = BLOCKS;
}
