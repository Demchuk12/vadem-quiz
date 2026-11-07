import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { VademLogo } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';

/** The site's main menu. Game screens go without it: they keep the screen for the game. */
@Component({
  selector: 'vq-app-nav',
  imports: [RouterLink, RouterLinkActive, VademLogo, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app-nav.scss',
  templateUrl: './app-nav.html',
})
export class AppNav {}
