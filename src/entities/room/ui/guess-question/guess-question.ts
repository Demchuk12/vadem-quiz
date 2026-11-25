import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdBadge } from '@vadem/ui/badge';
import { MESSAGES } from '../../i18n/messages';
import { guessAnswer, isFinalGuess } from '../../lib/guess';
import { RoomStore } from '../../model/room-store';

/**
 * The question of the round; its number once revealed. The stream also says what the number counts:
 * on a phone and on the host's page that stands beside the number.
 */
@Component({
  selector: 'vq-guess-question',
  imports: [VdBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './guess-question.scss',
  templateUrl: './guess-question.html',
})
export class GuessQuestion {
  protected readonly t = injectMessages(MESSAGES);
  /** The stream's size, read from across a room. */
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly room = inject(RoomStore).room;
  private readonly format = injectNumberFormat();

  protected readonly final = computed(() => {
    const room = this.room();
    return !!room && isFinalGuess(room);
  });
  protected readonly answer = computed(() => {
    const room = this.room();
    const answer = room && guessAnswer(room);
    if (!room || answer === null) return null;
    return [this.format(answer), room.guess_unit].filter(Boolean).join(' ');
  });
}
