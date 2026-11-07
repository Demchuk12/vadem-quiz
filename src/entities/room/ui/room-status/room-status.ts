import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VdSkeleton } from '@vadem/ui/skeleton';
import type { RoomLoadStatus } from '../../model/room-store';

/** Loading and failure states shared by the three game pages. */
@Component({
  selector: 'vq-room-status',
  imports: [RouterLink, VD_ALERT, VdButton, VdSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './room-status.scss',
  templateUrl: './room-status.html',
})
export class RoomStatus {
  readonly status = input.required<RoomLoadStatus>();
}
