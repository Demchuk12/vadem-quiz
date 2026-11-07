import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { HostSession, formatScore, type Player } from '@entities/room';
import { VdButton } from '@vadem/ui/button';
import { VD_DIALOG } from '@vadem/ui/dialog';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';

/** Open while `player` is set. The host can correct any score at any moment. */
@Component({
  selector: 'vq-adjust-score-dialog',
  imports: [VdButton, VD_DIALOG, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './adjust-score-dialog.scss',
  templateUrl: './adjust-score-dialog.html',
})
export class AdjustScoreDialog {
  readonly player = input.required<Player | null>();
  readonly closed = output<void>();

  private readonly host = inject(HostSession);

  protected readonly format = formatScore;
  protected readonly busy = this.host.busy;

  protected onOpenChange(open: boolean): void {
    if (!open) this.closed.emit();
  }

  protected async apply(event: Event, input: HTMLInputElement): Promise<void> {
    event.preventDefault();
    const player = this.player();
    const delta = input.valueAsNumber;
    if (!player || !Number.isInteger(delta) || delta === 0) return;

    if (await this.host.act((api, key) => api.adjustScore(key, player.id, delta))) {
      input.value = '';
      this.closed.emit();
    }
  }
}
