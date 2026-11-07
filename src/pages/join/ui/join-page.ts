import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomSessions } from '@entities/room';
import { InstallAppButton } from '@features/install-app';
import { JoinForm } from '@features/join-room';
import { TileBanner } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';

@Component({
  selector: 'vq-join-page',
  imports: [RouterLink, InstallAppButton, JoinForm, TileBanner, VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './join-page.scss',
  templateUrl: './join-page.html',
})
export class JoinPage {
  /** Room code from the URL, when opened through a shared link. */
  readonly code = input<string>();

  protected readonly lastGame = inject(RoomSessions).lastGameCode();
}
