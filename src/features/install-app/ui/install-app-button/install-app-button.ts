import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstallPrompt } from '@shared/lib';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';

/** Shows only where installing is possible and the app is not installed yet. */
@Component({
  selector: 'vq-install-app-button',
  imports: [VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './install-app-button.scss',
  templateUrl: './install-app-button.html',
})
export class InstallAppButton {
  protected readonly prompt = inject(InstallPrompt);
}
