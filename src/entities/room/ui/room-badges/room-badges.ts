import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { RoomStore } from '../../model/room-store';

/** The current round, and a warning while the screen may be out of date. */
@Component({
  selector: 'vq-room-badges',
  imports: [VdBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './room-badges.scss',
  templateUrl: './room-badges.html',
})
export class RoomBadges {
  protected readonly store = inject(RoomStore);
}
