import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { RoomBadges, RoomStore } from '@entities/room';
import { AppSettings } from '@features/app-settings';
import { Sound } from '@shared/lib';
import { VademLogo } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';
import { MESSAGES } from '../../i18n/messages';

/**
 * Title, round, connection, sound and settings. Project extra links into it. The stream's large one
 * has no settings: it stays clean, and follows the host's choice from the next tab.
 */
@Component({
  selector: 'vq-room-header',
  imports: [AppSettings, RoomBadges, VademLogo, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './room-header.scss',
  templateUrl: './room-header.html',
})
export class RoomHeader {
  protected readonly t = injectMessages(MESSAGES);
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly store = inject(RoomStore);
  protected readonly sound = inject(Sound);
}
