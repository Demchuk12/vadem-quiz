import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Confetti } from '@shared/ui';
import { formatScore } from '../../lib/game-logic';
import { RoomStore } from '../../model/room-store';

/** Who won. With shared first place it names the first in the standings. */
@Component({
  selector: 'vq-winner-banner',
  imports: [Confetti],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './winner-banner.scss',
  templateUrl: './winner-banner.html',
})
export class WinnerBanner {
  private readonly store = inject(RoomStore);

  protected readonly winner = computed(() => this.store.ranked()[0]?.player ?? null);
  protected readonly format = formatScore;
}
