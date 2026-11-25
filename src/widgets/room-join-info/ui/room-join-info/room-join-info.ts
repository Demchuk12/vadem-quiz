import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { RoomLinks } from '@entities/room';
import { JoinQr } from '@shared/ui';
import { VdCopyButton } from '@vadem/ui/copy-button';
import { MESSAGES } from '../../i18n/messages';

/** How to get into a room: QR code, room code, and the link. */
@Component({
  selector: 'vq-room-join-info',
  imports: [JoinQr, VdCopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-large]': 'large() ? "" : null' },
  styleUrl: './room-join-info.scss',
  templateUrl: './room-join-info.html',
})
export class RoomJoinInfo {
  protected readonly t = injectMessages(MESSAGES);
  readonly code = input.required<string>();
  /** For a shared screen, where the code is read from a distance. */
  readonly large = input(false, { transform: booleanAttribute });
  readonly copyable = input(false, { transform: booleanAttribute });

  private readonly links = inject(RoomLinks);

  protected readonly joinUrl = computed(() => this.links.join(this.code()));
  protected readonly characters = computed(() => [...this.code()]);
}
