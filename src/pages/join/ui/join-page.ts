import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JoinForm } from '@features/join-room';
import { TileBanner, VademLogo } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';

@Component({
  selector: 'vq-join-page',
  imports: [RouterLink, JoinForm, TileBanner, VademLogo, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './join-page.scss',
  templateUrl: './join-page.html',
})
export class JoinPage {
  /** Room code from the URL, when opened through a shared link. */
  readonly code = input<string>();
}
