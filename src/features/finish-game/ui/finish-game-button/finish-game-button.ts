import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HostSession, RoomApi } from '@entities/room';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';

@Component({
  selector: 'vq-finish-game-button',
  imports: [VdAlertDialog, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finish-game-button.html',
})
export class FinishGameButton {
  private readonly api = inject(RoomApi);
  private readonly host = inject(HostSession);

  protected readonly confirming = signal(false);

  /** The dialog shows a failure itself, so this one does not go through `HostSession.act`. */
  protected readonly finish = async (): Promise<void> => {
    await this.api.finishGame(this.host.key);
    this.confirming.set(false);
  };
}
