import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  OnInit,
  computed,
  inject,
  input,
} from '@angular/core';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { Sound } from '../../core/sound';
import { RoomStore } from '../../game/room-store';
import { GameBoard } from '../../shared/game-board';
import { playGameSounds } from '../../shared/game-sounds';
import { JoinQr } from '../../shared/join-qr';
import { QuestionView } from '../../shared/question-view';
import { RoomStatus } from '../../shared/room-status';
import { Standings } from '../../shared/standings';

/** Clean view for screen sharing: no controls and no answer before it is revealed. */
@Component({
  selector: 'vq-stream-page',
  imports: [VdBadge, VdButton, GameBoard, JoinQr, QuestionView, RoomStatus, Standings],
  providers: [RoomStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'vq-stream' },
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-6);
      min-block-size: 100dvh;
      align-content: start;
      padding: var(--vd-space-6);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-3);
      align-items: center;
    }
    h1 {
      margin-inline-end: auto;
      font-size: var(--vd-text-2xl);
      overflow-wrap: anywhere;
    }
    .layout {
      display: grid;
      gap: var(--vd-space-6);
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    @media (width >= 64rem) {
      .layout {
        grid-template-columns: minmax(0, 1fr) 22rem;
      }
    }
    .lobby {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-8);
      align-items: center;
    }
    .code {
      font-family: var(--vd-font-mono);
      font-size: clamp(3rem, 10vw, 7rem);
      font-weight: var(--vd-weight-bold);
      letter-spacing: var(--vd-tracking-caps);
      line-height: 1;
    }
    .stack {
      display: grid;
      gap: var(--vd-space-4);
      min-inline-size: 0;
    }
    .big {
      font-size: var(--vd-text-3xl);
      font-weight: var(--vd-weight-extrabold);
      overflow-wrap: anywhere;
    }
  `,
  template: `
    @if (store.status() !== 'ready') {
      <vq-room-status [status]="store.status()" />
    } @else if (store.room(); as room) {
      <header>
        <h1>{{ room.quiz_title }}</h1>
        <span vdBadge>Раунд {{ room.round }}/{{ room.round_count }}</span>
        @if (!store.connected()) {
          <span vdBadge variant="warning" role="status">Немає звʼязку</span>
        }
        <button
          vdButton
          size="sm"
          variant="ghost"
          [attr.aria-pressed]="sound.enabled()"
          (click)="sound.toggle()"
        >
          Звук: {{ sound.enabled() ? 'увімкнено' : 'вимкнено' }}
        </button>
      </header>

      <div class="layout">
        <div class="stack">
          @switch (room.state) {
            @case ('lobby') {
              <div class="lobby">
                <vq-join-qr [url]="joinUrl()" />
                <div>
                  <p class="vd-eyebrow">Код кімнати</p>
                  <p class="code">{{ room.code }}</p>
                </div>
              </div>
            }
            @case ('board') {
              <vq-game-board
                [columns]="store.columns()"
                [rows]="store.rows()"
                [round]="room.round"
              />
            }
            @case ('round_end') {
              <p class="big">Раунд {{ room.round }} завершено</p>
            }
            @case ('finished') {
              @if (store.ranked()[0]; as first) {
                <p class="big">Перемагає {{ first.player.nickname }}!</p>
              }
            }
            @default {
              <vq-question-view
                large
                [room]="room"
                [categoryTitle]="store.currentCell()?.category_title ?? null"
              />
              @switch (room.state) {
                @case ('buzzing_open') {
                  <p class="big">Хто перший?</p>
                }
                @case ('buzzed') {
                  <p class="big">{{ store.winner()?.nickname }} відповідає</p>
                }
              }
            }
          }
        </div>
        <aside aria-label="Рахунок">
          <vq-standings [ranked]="store.ranked()" />
        </aside>
      </div>
    }
  `,
})
export class StreamPage implements OnInit {
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);
  protected readonly sound = inject(Sound);
  private readonly document = inject(DOCUMENT);

  protected readonly joinUrl = computed(
    () => `${this.document.location.origin}/join/${this.room().toUpperCase()}`,
  );

  constructor() {
    playGameSounds(this.store, this.sound);
  }

  ngOnInit(): void {
    void this.store.connect(this.room());
  }
}
