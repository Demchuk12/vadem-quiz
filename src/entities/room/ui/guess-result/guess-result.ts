import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { MESSAGES } from '../../i18n/messages';
import { injectScoreFormat } from '../../lib/format';
import { guessRows } from '../../lib/guess';
import { RoomStore } from '../../model/room-store';

/** What the round brought one player. */
@Component({
  selector: 'vq-guess-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './guess-result.scss',
  templateUrl: './guess-result.html',
})
export class GuessResult {
  protected readonly t = injectMessages(MESSAGES);
  readonly playerId = input.required<string>();

  private readonly store = inject(RoomStore);
  protected readonly format = injectNumberFormat();
  protected readonly score = injectScoreFormat();

  protected readonly row = computed(() => {
    const room = this.store.room();
    const rows = room ? guessRows(room, this.store.players()) : [];
    return rows.find((row) => row.player_id === this.playerId()) ?? null;
  });
}
