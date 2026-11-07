import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { Confetti } from '@shared/ui';
import { VdIcon } from '@vadem/ui/icon';
import { formatScore } from '../../lib/game-logic';
import { RoomStore } from '../../model/room-store';

const VIBRATION = { correct: [70], wrong: [90, 70, 90] };

/**
 * The moment after the host's call. On the stage (the stream) everyone's verdict plays big; on a
 * phone only the player's own, with a buzz of the phone. It leaves on its own.
 */
@Component({
  selector: 'vq-verdict',
  imports: [Confetti, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './verdict.scss',
  templateUrl: './verdict.html',
  host: { '[attr.data-mode]': 'mode()' },
})
export class Verdict {
  readonly mode = input<'stage' | 'phone'>('stage');
  /** On a phone: whose verdicts to show. */
  readonly playerId = input<string | null>(null);

  private readonly store = inject(RoomStore);

  protected readonly shown = computed(() => {
    const verdict = this.store.verdict();
    if (!verdict) return null;
    if (this.mode() === 'phone' && verdict.playerId !== this.playerId()) return null;
    const points = formatScore(verdict.points);
    return { ...verdict, change: verdict.correct ? `+${points}` : `−${points}` };
  });

  constructor() {
    const navigator = inject(DOCUMENT).defaultView?.navigator;
    effect(() => {
      const verdict = this.shown();
      if (verdict && this.mode() === 'phone') {
        navigator?.vibrate?.(verdict.correct ? VIBRATION.correct : VIBRATION.wrong);
      }
    });
  }
}
