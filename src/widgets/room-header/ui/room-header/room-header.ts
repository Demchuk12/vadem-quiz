import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input } from '@angular/core';
import { RoomBadges, RoomStore } from '@entities/room';
import { Sound } from '@shared/lib';
import { VademLogo } from '@shared/ui';
import { VdButton } from '@vadem/ui/button';

/** Title, round, connection and sound. Project extra links into it. */
@Component({
  selector: 'vq-room-header',
  imports: [RoomBadges, VademLogo, VdButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './room-header.scss',
  templateUrl: './room-header.html',
})
export class RoomHeader {
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly store = inject(RoomStore);
  protected readonly sound = inject(Sound);
}
