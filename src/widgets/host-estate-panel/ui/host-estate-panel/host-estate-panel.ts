import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  EstateBoard,
  EstateCard,
  EstateCenter,
  EstatePlayers,
  HostSession,
  RoomApi,
  RoomStore,
  endPhaseOnTime,
  type Player,
} from '@entities/room';
import { EstateAuction } from '@features/estate-auction';
import { FinishGameButton } from '@features/finish-game';
import { injectMessages } from '@shared/i18n';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { MESSAGES } from '../../i18n/messages';

/** The host's "Господар": the whole board for a laptop or a stream, the players and their cards. */
@Component({
  selector: 'vq-host-estate-panel',
  imports: [
    EstateAuction,
    FinishGameButton,
    EstateBoard,
    EstateCard,
    EstateCenter,
    EstatePlayers,
    VdAlertDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host-estate-panel.scss',
  templateUrl: './host-estate-panel.html',
})
export class HostEstatePanel {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly store = inject(RoomStore);
  private readonly host = inject(HostSession);
  private readonly api = inject(RoomApi);

  protected readonly selected = signal<number | null>(null);
  protected readonly selectedCell = computed(
    () => this.store.estateCells().find((c) => c.idx === this.selected()) ?? null,
  );
  protected readonly removing = signal<Player | null>(null);
  protected readonly removeLabel = (nickname: string) => this.t().remove(nickname);

  constructor() {
    endPhaseOnTime(['estate_playing'], () =>
      this.api.estateTimeout(this.host.key.roomId, this.host.key.token),
    );
  }

  /** The dialog shows a failure itself. */
  protected readonly remove = async (): Promise<void> => {
    const player = this.removing();
    if (player) await this.api.estateRemovePlayer(this.host.key, player.id);
    this.removing.set(null);
  };
}
