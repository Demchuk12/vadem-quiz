import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  GuessQuestion,
  GuessScale,
  HostSession,
  PhaseProgress,
  PhaseTimer,
  RoomApi,
  RoomStore,
  endPhaseOnTime,
  type GuessHostQuestion,
} from '@entities/room';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

/**
 * The host's view of a "На око" question: the number only they see, who has answered, and the step
 * on. This page reveals the answer when the clock runs out; the players' last answer does it sooner.
 */
@Component({
  selector: 'vq-host-guess-panel',
  imports: [GuessQuestion, GuessScale, PhaseProgress, PhaseTimer, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host-guess-panel.scss',
  templateUrl: './host-guess-panel.html',
})
export class HostGuessPanel {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly store = inject(RoomStore);
  protected readonly host = inject(HostSession);
  private readonly api = inject(RoomApi);
  private readonly format = injectNumberFormat();

  private readonly round = computed(() => this.store.room()?.round);
  protected readonly question = signal<GuessHostQuestion | null>(null);
  protected readonly answer = computed(() => {
    const question = this.question();
    if (!question) return null;
    return [this.format(question.answer), this.store.room()?.guess_unit].filter(Boolean).join(' ');
  });
  protected readonly last = computed(() => {
    const room = this.store.room();
    return !!room && room.round >= room.round_count;
  });

  constructor() {
    effect(() => {
      const round = this.round();
      if (round === undefined) return;
      untracked(() => {
        this.question.set(null);
        void this.api
          .guessHostQuestion(this.host.key)
          .then((question) => {
            if (this.round() === round) this.question.set(question);
          })
          .catch(() => undefined);
      });
    });
    endPhaseOnTime(['guess_open'], () => this.api.guessReveal(this.host.key));
  }

  protected next(): void {
    const open = this.store.room()?.state === 'guess_open';
    void this.host.act((api, key) => (open ? api.guessReveal(key) : api.guessNext(key)));
  }
}
