import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { Confetti } from '@shared/ui';
import { injectScoreFormat } from '../../lib/format';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

/** Who won. With shared first place it names the first in the standings. */
@Component({
  selector: 'vq-winner-banner',
  imports: [Confetti],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './winner-banner.scss',
  templateUrl: './winner-banner.html',
})
export class WinnerBanner {
  protected readonly t = injectMessages(MESSAGES);
  private readonly store = inject(RoomStore);

  protected readonly winner = computed(() => this.store.ranked()[0]?.player ?? null);
  protected readonly format = injectScoreFormat();
}
