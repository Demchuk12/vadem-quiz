import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallPrompt } from '@shared/lib';
import { VdToasterOutlet } from '@vadem/ui/toast';
import { AppUpdates } from './app-updates';

@Component({
  selector: 'vq-root',
  imports: [RouterOutlet, VdToasterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  constructor() {
    inject(AppUpdates).watch();
    // The browser announces installability once, possibly before any page that offers it opens.
    inject(InstallPrompt);
  }
}
