import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  GameBoard,
  HostSession,
  RoomLinks,
  RoomStatus,
  RoomStore,
  Standings,
  WinnerBanner,
  normalizeRoomCode,
  playGameSounds,
  type Player,
  type RoomCell,
} from '@entities/room';
import { AdjustScoreDialog } from '@features/adjust-score';
import { FinishGameButton } from '@features/finish-game';
import { Sound } from '@shared/lib';
import { SidebarLayout } from '@shared/ui';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdIcon } from '@vadem/ui/icon';
import { HostQuestionPanel } from '@widgets/host-question-panel';
import { RoomHeader } from '@widgets/room-header';
import { RoomJoinInfo } from '@widgets/room-join-info';

@Component({
  selector: 'vq-host-page',
  imports: [
    RouterLink,
    VD_ALERT,
    VdButton,
    VD_CARD,
    VdIcon,
    AdjustScoreDialog,
    FinishGameButton,
    GameBoard,
    HostQuestionPanel,
    RoomHeader,
    RoomJoinInfo,
    RoomStatus,
    SidebarLayout,
    Standings,
    WinnerBanner,
  ],
  providers: [RoomStore, HostSession],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host-page.scss',
  templateUrl: './host-page.html',
})
export class HostPage implements OnInit {
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);
  protected readonly host = inject(HostSession);
  private readonly links = inject(RoomLinks);

  protected readonly adjusting = signal<Player | null>(null);
  private readonly code = computed(() => normalizeRoomCode(this.room()));
  protected readonly streamUrl = computed(() => this.links.stream(this.code()));

  constructor() {
    playGameSounds(this.store, inject(Sound));
  }

  async ngOnInit(): Promise<void> {
    await this.store.connect(this.code());
    const room = this.store.room();
    if (room) await this.host.authorize(this.code(), room.id);
  }

  protected act(action: 'startGame' | 'nextRound'): void {
    void this.host.act((api, key) => api[action](key));
  }

  protected openQuestion(cell: RoomCell): void {
    void this.host.act((api, key) => api.openQuestion(key, cell.id));
  }
}
