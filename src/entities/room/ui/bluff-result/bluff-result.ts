import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { bluffResult } from '../../lib/bluff';
import { formatScore } from '../../lib/game-logic';
import { RoomStore } from '../../model/room-store';

/** What the round brought one player: what they picked, who fell for them, their points. */
@Component({
  selector: 'vq-bluff-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-result.scss',
  templateUrl: './bluff-result.html',
})
export class BluffResult {
  readonly playerId = input.required<string>();

  private readonly store = inject(RoomStore);

  protected readonly result = computed(() => {
    const room = this.store.room();
    return room ? bluffResult(room, this.store.players(), this.playerId()) : null;
  });
  protected readonly delta = computed(() => {
    const delta = this.result()?.delta ?? 0;
    return delta > 0 ? `+${formatScore(delta)}` : formatScore(delta);
  });
}
