import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RoomApi, RoomStore, votableOptions, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';

/** The options of the round, but none with the player's own words; the vote may change. */
@Component({
  selector: 'vq-bluff-voter',
  imports: [VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-voter.scss',
  templateUrl: './bluff-voter.html',
})
export class BluffVoter {
  readonly session = input.required<PlayerSession>();

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();

  protected readonly busy = this.action.busy;
  private readonly ownAnswer = signal<string | null>(null);
  protected readonly chosen = signal<string | null>(null);
  protected readonly options = computed(() =>
    votableOptions(this.store.room()?.bluff_options ?? [], this.ownAnswer()),
  );
  protected readonly done = computed(() => this.store.room()?.bluff_done.length ?? 0);
  protected readonly total = computed(() => this.store.players().length);

  constructor() {
    // The own lie decides which options to hide; a reloaded phone also gets its vote back.
    effect(() => {
      const round = this.store.room()?.round;
      const session = this.session();
      if (round === undefined) return;
      untracked(() => {
        this.chosen.set(null);
        void this.api
          .bluffMyRound(session.roomId, session.playerId, session.token)
          .then(({ answer, option_id }) => {
            this.ownAnswer.set(answer);
            this.chosen.set(option_id);
          })
          .catch(() => undefined);
      });
    });
  }

  protected async vote(optionId: string): Promise<void> {
    const session = this.session();
    const previous = this.chosen();
    this.chosen.set(optionId);
    const done = await this.action.run(() =>
      this.api.bluffVote(session.roomId, session.playerId, session.token, optionId),
    );
    if (!done) this.chosen.set(previous);
  }
}
