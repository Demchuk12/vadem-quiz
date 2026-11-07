import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  GameBoard,
  QuestionView,
  RoomApi,
  RoomSessions,
  RoomBadges,
  RoomStatus,
  RoomStore,
  Standings,
  WinnerBanner,
  formatScore,
  normalizeRoomCode,
  type PlayerSession,
} from '@entities/room';
import { BuzzButton } from '@features/buzz';
import { VademLogo } from '@shared/ui';
import { VD_CARD } from '@vadem/ui/card';

@Component({
  selector: 'vq-play-page',
  imports: [
    VD_CARD,
    BuzzButton,
    GameBoard,
    QuestionView,
    RoomBadges,
    RoomStatus,
    Standings,
    VademLogo,
    WinnerBanner,
  ],
  providers: [RoomStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './play-page.scss',
  templateUrl: './play-page.html',
})
export class PlayPage implements OnInit {
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly sessions = inject(RoomSessions);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly format = formatScore;
  protected readonly session = signal<PlayerSession | null>(null);
  protected readonly playerId = computed(() => this.session()?.playerId ?? null);
  protected readonly me = computed(
    () => this.store.players().find((p) => p.id === this.playerId()) ?? null,
  );

  private wakeLock: WakeLockSentinel | null = null;

  async ngOnInit(): Promise<void> {
    const code = normalizeRoomCode(this.room());
    const session = this.sessions.player(code);
    if (!session) {
      await this.router.navigate(['/join', code]);
      return;
    }
    // A network failure says nothing about the session: keep it and let the store report.
    const valid = await this.api.isPlayer(session.playerId, session.token).catch(() => true);
    if (!valid) {
      this.sessions.forgetPlayer(code);
      await this.router.navigate(['/join', code]);
      return;
    }
    this.session.set(session);
    await this.store.connect(code, session.playerId);
    this.keepScreenOn();
  }

  /** A phone that dims mid-question would cost the player the press. Unsupported is fine. */
  private keepScreenOn(): void {
    const request = () => {
      if (this.document.visibilityState !== 'visible') return;
      void this.document.defaultView?.navigator.wakeLock
        ?.request('screen')
        .then((lock) => (this.wakeLock = lock))
        .catch(() => undefined);
    };
    request();
    this.document.addEventListener('visibilitychange', request);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', request);
      void this.wakeLock?.release();
    });
  }
}
