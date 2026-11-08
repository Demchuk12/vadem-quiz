import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HostSession, LateLadder, RoomStore, everyoneSpent } from '@entities/room';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';

/** The host's actions on the open question: open presses, judge, skip, back to the board. */
@Component({
  selector: 'vq-question-controls',
  imports: [VdBadge, VdButton, VdIcon, LateLadder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './question-controls.scss',
  templateUrl: './question-controls.html',
})
export class QuestionControls {
  protected readonly store = inject(RoomStore);
  private readonly host = inject(HostSession);

  protected readonly busy = this.host.busy;
  protected readonly nobodyLeft = computed(() => {
    const room = this.store.room();
    return room ? everyoneSpent(room, this.store.players()) : false;
  });

  protected act(action: 'openBuzz' | 'skipQuestion' | 'returnToBoard'): void {
    void this.host.act((api, key) => api[action](key));
  }

  protected judge(correct: boolean): void {
    void this.host.act((api, key) => api.judge(key, correct));
  }
}
