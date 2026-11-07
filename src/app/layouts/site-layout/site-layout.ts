import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNav } from '@widgets/app-nav';

/** Screens outside a game: the menu above the page. */
@Component({
  selector: 'vq-site-layout',
  imports: [AppNav, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './site-layout.scss',
  templateUrl: './site-layout.html',
})
export class SiteLayout {}
