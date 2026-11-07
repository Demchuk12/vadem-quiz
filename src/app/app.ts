import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { QuestionLoader } from '@shared/ui';
import { filter, map } from 'rxjs';
import { InstallPrompt } from '@shared/lib';
import { VdToasterOutlet } from '@vadem/ui/toast';
import { AppUpdates } from './app-updates';

@Component({
  selector: 'vq-root',
  imports: [RouterOutlet, QuestionLoader, VdToasterOutlet],
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  /** A page loads its code on first visit; a slow one shows the loader instead of nothing. */
  protected readonly navigating = toSignal(
    inject(Router).events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  constructor() {
    inject(AppUpdates).watch();
    // The browser announces installability once, possibly before any page that offers it opens.
    inject(InstallPrompt);
  }
}
