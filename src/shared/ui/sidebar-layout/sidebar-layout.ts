import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Main content with a side column from 64rem. Set `--vq-sidebar-size` and `--vq-sidebar-gap`. */
@Component({
  selector: 'vq-sidebar-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sidebar-layout.scss',
  templateUrl: './sidebar-layout.html',
})
export class SidebarLayout {}
