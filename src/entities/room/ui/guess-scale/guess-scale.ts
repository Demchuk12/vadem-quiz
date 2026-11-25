import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { MESSAGES } from '../../i18n/messages';
import { injectScoreFormat } from '../../lib/format';
import { guessRows, type GuessRow } from '../../lib/guess';
import { RoomStore } from '../../model/room-store';

/**
 * The reveal: where every answer stands against the right one, then who came how close. The rows
 * come in from the farthest, so the winner is the last to appear.
 */
@Component({
  selector: 'vq-guess-scale',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './guess-scale.scss',
  templateUrl: './guess-scale.html',
})
export class GuessScale {
  protected readonly t = injectMessages(MESSAGES);
  readonly large = input(false, { transform: booleanAttribute });
  /** The row of the person looking at the screen. */
  readonly currentPlayerId = input<string | null>(null);

  private readonly store = inject(RoomStore);
  private readonly format = injectNumberFormat();
  private readonly score = injectScoreFormat();

  protected readonly rows = computed(() => {
    const room = this.store.room();
    return room ? guessRows(room, this.store.players()) : [];
  });

  protected value(row: GuessRow): string {
    return this.format(row.value);
  }

  protected miss(row: GuessRow): string {
    const { exact, offBy } = this.t().guess;
    return row.exact ? exact : offBy(this.withUnit(this.format(row.distance)));
  }

  protected points(row: GuessRow): string {
    return row.delta > 0 ? `+${this.score(row.delta)}` : '0';
  }

  /** From the start of the line, in percent. */
  protected at(row: GuessRow): string {
    return `${50 + row.position * 50}%`;
  }

  private withUnit(number: string): string {
    return [number, this.store.room()?.guess_unit].filter(Boolean).join(' ');
  }
}
