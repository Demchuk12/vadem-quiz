import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import {
  BluffFact,
  PhaseProgress,
  BluffReveal,
  GameBoard,
  GuessQuestion,
  GuessScale,
  PhaseTimer,
  QuestionView,
  RoomStatus,
  RoomStore,
  Standings,
  WinnerBanner,
  playGameSounds,
  VerdictScene,
  LateLadder,
} from '@entities/room';
import { Sound } from '@shared/lib';
import { SidebarLayout } from '@shared/ui';
import { RoomHeader } from '@widgets/room-header';
import { RoomJoinInfo } from '@widgets/room-join-info';
import { MESSAGES } from '../i18n/messages';

/** Clean view for screen sharing: no controls and no answer before it is revealed. */
@Component({
  selector: 'vq-stream-page',
  imports: [
    BluffFact,
    PhaseProgress,
    BluffReveal,
    PhaseTimer,
    LateLadder,
    VerdictScene,
    GameBoard,
    GuessQuestion,
    GuessScale,
    QuestionView,
    RoomHeader,
    RoomJoinInfo,
    RoomStatus,
    SidebarLayout,
    Standings,
    WinnerBanner,
  ],
  providers: [RoomStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'vq-stream' },
  styleUrl: './stream-page.scss',
  templateUrl: './stream-page.html',
})
export class StreamPage implements OnInit {
  protected readonly t = injectMessages(MESSAGES);
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);

  constructor() {
    playGameSounds(this.store, inject(Sound));
  }

  ngOnInit(): void {
    void this.store.connect(this.room());
  }
}
