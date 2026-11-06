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
import { VdBadge } from '@vadem/ui/badge';
import { VdBuzzer, type VdBuzzerState } from '@vadem/ui/buzzer';
import { VD_CARD } from '@vadem/ui/card';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage, isApiError } from '../../core/api-error';
import { GameApi } from '../../core/game-api';
import { LocalStore, type PlayerSession } from '../../core/local-store';
import { buzzerStateFor, formatScore } from '../../game/game-logic';
import { RoomStore } from '../../game/room-store';
import { GameBoard } from '../../shared/game-board';
import { QuestionView } from '../../shared/question-view';
import { RoomStatus } from '../../shared/room-status';
import { Standings } from '../../shared/standings';

const PRESS_VIBRATION_MS = 40;

@Component({
  selector: 'vq-play-page',
  imports: [VdBadge, VdBuzzer, VD_CARD, GameBoard, QuestionView, RoomStatus, Standings],
  providers: [RoomStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-4);
      min-block-size: 100dvh;
      align-content: start;
      padding: var(--vd-space-3) var(--vd-space-4) var(--vd-space-8);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
      align-items: center;
    }
    .me {
      margin-inline-end: auto;
      font-weight: var(--vd-weight-semibold);
      overflow-wrap: anywhere;
    }
    .score {
      font-size: var(--vd-text-xl);
      font-weight: var(--vd-weight-extrabold);
      font-variant-numeric: tabular-nums;
    }
    .buzzer-area {
      display: grid;
      justify-items: center;
      padding-block: var(--vd-space-2);
    }
    .buzzer-area .vd-buzzer {
      --vd-buzzer-size: min(70vw, 45dvh, 20rem);
    }
    h2 {
      font-size: var(--vd-text-xl);
    }
    .notice {
      color: var(--vd-color-text-muted);
    }
    .stack {
      display: grid;
      gap: var(--vd-space-4);
    }
    .winner {
      font-size: var(--vd-text-2xl);
      font-weight: var(--vd-weight-extrabold);
      overflow-wrap: anywhere;
    }
  `,
  template: `
    @if (store.status() !== 'ready') {
      <vq-room-status [status]="store.status()" />
    } @else if (store.room(); as room) {
      <h1 class="vd-visually-hidden">{{ room.quiz_title }}</h1>
      <header>
        <span class="me">{{ me()?.nickname }}</span>
        @if (!store.connected()) {
          <span vdBadge variant="warning" role="status">Немає звʼязку</span>
        }
        <span vdBadge>Раунд {{ room.round }}/{{ room.round_count }}</span>
        <span class="score" aria-label="Ваш рахунок">{{ format(me()?.score ?? 0) }}</span>
      </header>

      <p class="vd-visually-hidden" aria-live="assertive">{{ buzzerLabel() }}</p>

      @switch (room.state) {
        @case ('lobby') {
          <section vdCard class="stack">
            <h2>Ви в кімнаті {{ room.code }}</h2>
            <p class="notice">Гра почнеться, щойно ведучий її запустить.</p>
          </section>
          <vq-standings
            [ranked]="store.ranked()"
            [currentPlayerId]="playerId()"
            [onlineIds]="store.onlinePlayerIds()"
          />
        }
        @case ('board') {
          <p class="notice">Ведучий обирає питання.</p>
          <vq-game-board [columns]="store.columns()" [rows]="store.rows()" [round]="room.round" />
          <vq-standings [ranked]="store.ranked()" [currentPlayerId]="playerId()" />
        }
        @case ('round_end') {
          <h2>Раунд {{ room.round }} завершено</h2>
          <vq-standings [ranked]="store.ranked()" [currentPlayerId]="playerId()" />
        }
        @case ('finished') {
          <h2>Гру завершено</h2>
          @if (store.ranked()[0]; as first) {
            <p class="winner">Перемагає {{ first.player.nickname }}</p>
          }
          <vq-standings [ranked]="store.ranked()" [currentPlayerId]="playerId()" />
        }
        @case ('answer_shown') {
          <vq-question-view
            [room]="room"
            [categoryTitle]="store.currentCell()?.category_title ?? null"
          />
          <vq-standings [ranked]="store.ranked()" [currentPlayerId]="playerId()" />
        }
        @default {
          <vq-question-view
            [room]="room"
            [categoryTitle]="store.currentCell()?.category_title ?? null"
          />
          <div class="buzzer-area">
            <button vdBuzzer [state]="buzzerState()" (buzz)="press()">{{ buzzerLabel() }}</button>
          </div>
        }
      }
    }
  `,
})
export class PlayPage implements OnInit {
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);
  private readonly api = inject(GameApi);
  private readonly local = inject(LocalStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(VdToaster);
  private readonly document = inject(DOCUMENT);

  protected readonly format = formatScore;
  private readonly session = signal<PlayerSession | null>(null);
  private readonly pressing = signal(false);

  protected readonly playerId = computed(() => this.session()?.playerId ?? null);
  protected readonly me = computed(
    () => this.store.players().find((p) => p.id === this.playerId()) ?? null,
  );

  protected readonly buzzerState = computed<VdBuzzerState>(() => {
    const room = this.store.room();
    const id = this.playerId();
    if (!room || !id) return 'locked';
    const state = buzzerStateFor(room, id);
    // Between the press and the server's reply the button must not take a second press.
    return this.pressing() && state === 'ready' ? 'locked' : state;
  });

  protected readonly buzzerLabel = computed(() => {
    const room = this.store.room();
    if (!room || !['question_shown', 'buzzing_open', 'buzzed'].includes(room.state)) return '';
    switch (this.buzzerState()) {
      case 'ready':
        return 'Відповісти!';
      case 'won':
        return 'Ви відповідаєте!';
      case 'spent':
        return 'Спробу використано';
      case 'locked':
        if (this.pressing()) return 'Надсилаємо…';
        if (room.state === 'buzzed')
          return `${this.store.winner()?.nickname ?? 'Хтось'} відповідає`;
        return 'Зачекайте';
    }
  });

  private wakeLock: WakeLockSentinel | null = null;
  private readonly destroyRef = inject(DestroyRef);

  async ngOnInit(): Promise<void> {
    const code = this.room().toUpperCase();
    const session = this.local.playerSession(code);
    if (!session) {
      await this.router.navigate(['/join', code]);
      return;
    }
    const valid = await this.api.isRoomPlayer(session.playerId, session.token).catch((error) => {
      // A network failure says nothing about the session: keep it and let the store report.
      return !isApiError(error, 'not_authorized');
    });
    if (!valid) {
      this.local.forgetPlayerSession(code);
      await this.router.navigate(['/join', code]);
      return;
    }
    this.session.set(session);
    await this.store.connect(code, session.playerId);
    this.keepScreenOn();
  }

  protected async press(): Promise<void> {
    const session = this.session();
    if (!session || this.pressing()) return;
    this.pressing.set(true);
    this.document.defaultView?.navigator.vibrate?.(PRESS_VIBRATION_MS);
    try {
      // The outcome reaches the screen through the room's realtime update.
      await this.api.buzz(session.roomId, session.playerId, session.token);
    } catch (error) {
      this.toaster.error(errorMessage(error));
    } finally {
      this.pressing.set(false);
    }
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
