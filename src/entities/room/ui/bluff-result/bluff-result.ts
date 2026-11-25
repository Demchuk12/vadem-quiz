import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { bluffResult } from '../../lib/bluff';
import { injectScoreFormat } from '../../lib/format';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

/** What the round brought one player: what they picked, who fell for them, their points. */
@Component({
  selector: 'vq-bluff-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-result.scss',
  templateUrl: './bluff-result.html',
})
export class BluffResult {
  protected readonly t = injectMessages(MESSAGES);
  readonly playerId = input.required<string>();

  private readonly store = inject(RoomStore);
  private readonly format = injectScoreFormat();

  protected readonly result = computed(() => {
    const room = this.store.room();
    return room ? bluffResult(room, this.store.players(), this.playerId()) : null;
  });
  protected readonly delta = computed(() => {
    const delta = this.result()?.delta ?? 0;
    return delta > 0 ? `+${this.format(delta)}` : this.format(delta);
  });
}
