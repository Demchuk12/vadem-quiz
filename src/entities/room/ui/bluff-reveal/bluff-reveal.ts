import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { revealOrder, type RevealedOption } from '../../lib/bluff';
import { RoomStore } from '../../model/room-store';
import { MESSAGES } from '../../i18n/messages';

/**
 * The options of the round. While voting, only their words; at the reveal, one after another:
 * whose each was and who fell for it, the truth last.
 */
@Component({
  selector: 'vq-bluff-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './bluff-reveal.scss',
  templateUrl: './bluff-reveal.html',
})
export class BluffReveal {
  protected readonly t = injectMessages(MESSAGES);
  readonly large = input(false, { transform: booleanAttribute });

  private readonly store = inject(RoomStore);

  protected readonly revealed = computed(() => this.store.room()?.state === 'bluff_reveal');
  protected readonly options = computed(() => {
    const room = this.store.room();
    if (!room) return [];
    return this.revealed()
      ? revealOrder(room, this.store.players())
      : (room.bluff_options ?? []).map((option) => ({ option, author: null, voters: [] }));
  });

  protected label(entry: RevealedOption): string {
    const { truth, decoy, lieOf } = this.t().bluff;
    if (entry.author !== null) return lieOf(entry.author);
    return entry.option.kind === 'truth' ? truth : decoy;
  }

  /** Nobody falls for the truth: they guess it. */
  protected votersText(entry: RevealedOption): string {
    const { guessed, fell } = this.t().bluff;
    const say = entry.option.kind === 'truth' ? guessed : fell;
    return say(entry.voters.join(', '));
  }
}
