import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdBadge } from '@vadem/ui/badge';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdCopyButton } from '@vadem/ui/copy-button';
import { VD_DIALOG } from '@vadem/ui/dialog';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage } from '../../core/api-error';
import { GameApi, type HostAnswer } from '../../core/game-api';
import { LocalStore } from '../../core/local-store';
import { Media } from '../../core/media';
import { Sound } from '../../core/sound';
import { everyoneSpent, formatScore } from '../../game/game-logic';
import type { Player, RoomCell } from '../../game/models';
import { RoomStore } from '../../game/room-store';
import { playGameSounds } from '../../shared/game-sounds';
import { GameBoard } from '../../shared/game-board';
import { JoinQr } from '../../shared/join-qr';
import { QuestionView } from '../../shared/question-view';
import { RoomStatus } from '../../shared/room-status';
import { Standings } from '../../shared/standings';

const TICK_MS = 1000;

@Component({
  selector: 'vq-host-page',
  imports: [
    VD_ALERT,
    VdAlertDialog,
    VdBadge,
    VdButton,
    VD_CARD,
    VdCopyButton,
    VD_DIALOG,
    VdField,
    VdIcon,
    VdInput,
    GameBoard,
    JoinQr,
    QuestionView,
    RoomStatus,
    Standings,
  ],
  providers: [RoomStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-4);
      padding: var(--vd-space-4);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
      align-items: center;
    }
    header h1 {
      margin-inline-end: auto;
      font-size: var(--vd-text-xl);
      overflow-wrap: anywhere;
    }
    .layout {
      display: grid;
      gap: var(--vd-space-4);
      align-items: start;
    }
    @media (width >= 64rem) {
      .layout {
        grid-template-columns: minmax(0, 1fr) 20rem;
      }
    }
    .stack {
      display: grid;
      gap: var(--vd-space-4);
      min-inline-size: 0;
    }
    .lobby {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: start;
      gap: var(--vd-space-6);
      align-items: center;
    }
    .code {
      font-family: var(--vd-font-mono);
      font-size: var(--vd-text-4xl);
      font-weight: var(--vd-weight-bold);
      letter-spacing: var(--vd-tracking-caps);
    }
    .lobby-info {
      display: grid;
      gap: var(--vd-space-3);
      justify-items: start;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
      align-items: center;
    }
    .host-answer {
      display: grid;
      gap: var(--vd-space-1);
      padding: var(--vd-space-3);
      border: var(--vd-border-width) dashed var(--vd-color-border-control);
      border-radius: var(--vd-radius-md);
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    .host-answer img {
      max-inline-size: 12rem;
      border-radius: var(--vd-radius-sm);
    }
    .timer {
      font-family: var(--vd-font-mono);
      font-variant-numeric: tabular-nums;
      color: var(--vd-color-text-muted);
    }
    .winner {
      font-size: var(--vd-text-xl);
      font-weight: var(--vd-weight-bold);
      overflow-wrap: anywhere;
    }
    form {
      display: grid;
      gap: var(--vd-space-3);
    }
    .quick {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
    }
  `,
  template: `
    @if (store.status() !== 'ready') {
      <vq-room-status [status]="store.status()" />
    } @else if (!authorized()) {
      <div vdAlert variant="danger" role="alert">
        <p vdAlertTitle>Ви не ведучий цієї гри</p>
        <p>Панель керування відкривається лише на пристрої, де гру створили.</p>
      </div>
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
        <a vdButton size="sm" target="_blank" rel="noopener" [href]="streamUrl()">
          <vd-icon slot="start" name="monitor" />
          Екран для стріму
        </a>
      </header>

      <div class="layout">
        <div class="stack">
          @switch (room.state) {
            @case ('lobby') {
              <section vdCard class="lobby">
                <vq-join-qr [url]="joinUrl()" />
                <div class="lobby-info">
                  <p class="vd-eyebrow">Код кімнати</p>
                  <p class="code">{{ room.code }}</p>
                  <vd-copy-button
                    [value]="joinUrl()"
                    label="Скопіювати посилання"
                    copiedLabel="Скопійовано"
                  />
                  <button
                    vdButton
                    variant="primary"
                    size="lg"
                    [loading]="busy()"
                    [disabled]="store.players().length === 0"
                    (click)="act('startGame')"
                  >
                    <vd-icon slot="start" name="rocket" />
                    Почати гру
                  </button>
                </div>
              </section>
            }
            @case ('board') {
              <vq-game-board
                [columns]="store.columns()"
                [rows]="store.rows()"
                [round]="room.round"
                interactive
                (pick)="openQuestion($event)"
              />
              @if (room.round < room.round_count) {
                <div class="controls">
                  <button vdButton (click)="act('nextRound')">Завершити раунд достроково</button>
                </div>
              }
            }
            @case ('round_end') {
              <section vdCard>
                <h2>Раунд {{ room.round }} завершено</h2>
                <div class="controls">
                  <button
                    vdButton
                    variant="primary"
                    size="lg"
                    [loading]="busy()"
                    (click)="act('nextRound')"
                  >
                    {{ room.round < room.round_count ? 'Наступний раунд' : 'Підбити підсумки' }}
                  </button>
                </div>
              </section>
            }
            @case ('finished') {
              <section vdCard>
                <h2>Гру завершено</h2>
                @if (store.ranked()[0]; as first) {
                  <p class="winner">
                    Перемагає {{ first.player.nickname }}:
                    {{ format(first.player.score) }}
                  </p>
                }
              </section>
            }
            @default {
              <section vdCard class="stack">
                <vq-question-view
                  [room]="room"
                  [categoryTitle]="store.currentCell()?.category_title ?? null"
                />

                @if (room.state !== 'answer_shown' && answer(); as hostAnswer) {
                  <div class="host-answer">
                    <p class="vd-eyebrow">Відповідь (бачите лише ви)</p>
                    @if (hostAnswer.answer_text) {
                      <p>{{ hostAnswer.answer_text }}</p>
                    }
                    @if (hostAnswer.answer_image_path; as path) {
                      <img [src]="media.publicUrl(path)" alt="Картинка до відповіді" />
                    }
                  </div>
                }

                <div class="controls" aria-live="polite">
                  @switch (room.state) {
                    @case ('question_shown') {
                      <button
                        vdButton
                        variant="primary"
                        size="lg"
                        [loading]="busy()"
                        (click)="act('openBuzz')"
                      >
                        Відкрити відповіді
                      </button>
                    }
                    @case ('buzzing_open') {
                      @if (nobodyLeft()) {
                        <span vdBadge variant="warning">Усі вже відповідали</span>
                      } @else {
                        <span vdBadge variant="info">Чекаємо на натискання</span>
                      }
                    }
                    @case ('buzzed') {
                      <span class="winner">{{ store.winner()?.nickname }} відповідає</span>
                      <button vdButton variant="primary" [loading]="busy()" (click)="judge(true)">
                        <vd-icon slot="start" name="check" />
                        Правильно
                      </button>
                      <button vdButton variant="danger" [disabled]="busy()" (click)="judge(false)">
                        <vd-icon slot="start" name="x" />
                        Неправильно
                      </button>
                    }
                    @case ('answer_shown') {
                      <button
                        vdButton
                        variant="primary"
                        size="lg"
                        [loading]="busy()"
                        (click)="act('returnToBoard')"
                      >
                        До дошки
                      </button>
                    }
                  }
                  @if (room.state !== 'answer_shown') {
                    <button
                      vdButton
                      variant="ghost"
                      [disabled]="busy()"
                      (click)="act('skipQuestion')"
                    >
                      Пропустити
                    </button>
                    <span class="timer" role="timer" aria-label="Час на питанні">{{
                      timer()
                    }}</span>
                  }
                </div>
              </section>
            }
          }
        </div>

        <aside class="stack" aria-label="Рахунок">
          <vq-standings
            [ranked]="store.ranked()"
            [onlineIds]="store.onlinePlayerIds()"
            editable
            (adjust)="adjusting.set($event)"
          />
          @if (room.state !== 'finished') {
            <button vdButton variant="ghost" (click)="finishing.set(true)">Завершити гру</button>
          }
        </aside>
      </div>

      <dialog vdDialog size="sm" [open]="adjusting() !== null" (openChange)="closeAdjust($event)">
        <header vdDialogHeader>
          <h2 vdDialogTitle>Змінити очки: {{ adjusting()?.nickname }}</h2>
          <p vdDialogDescription>Зараз {{ format(adjusting()?.score ?? 0) }} очок.</p>
        </header>
        <form vdDialogBody (submit)="applyDelta($event, delta.valueAsNumber); delta.value = ''">
          <vd-field label="На скільки змінити" hint="Від’ємне значення віднімає очки.">
            <input vdInput #delta type="number" step="1" required />
          </vd-field>
          <div class="quick">
            <button vdButton type="submit" variant="primary" [loading]="busy()">Застосувати</button>
          </div>
        </form>
      </dialog>

      <vd-alert-dialog
        title="Завершити гру?"
        description="Гравці побачать підсумки, продовжити цю гру вже не вийде."
        confirmLabel="Завершити"
        cancelLabel="Скасувати"
        variant="danger"
        [open]="finishing()"
        [action]="finish"
        (openChange)="finishing.set($event)"
      />
    }
  `,
})
export class HostPage implements OnInit {
  /** Room code from the URL. */
  readonly room = input.required<string>();

  protected readonly store = inject(RoomStore);
  private readonly api = inject(GameApi);
  protected readonly media = inject(Media);
  protected readonly sound = inject(Sound);
  private readonly local = inject(LocalStore);
  private readonly toaster = inject(VdToaster);
  private readonly document = inject(DOCUMENT);

  protected readonly format = formatScore;
  protected readonly token = signal('');
  protected readonly authorized = signal(false);
  protected readonly busy = signal(false);
  protected readonly answer = signal<HostAnswer | null>(null);
  protected readonly adjusting = signal<Player | null>(null);
  protected readonly finishing = signal(false);
  protected readonly seconds = signal(0);

  protected readonly nobodyLeft = computed(() => {
    const room = this.store.room();
    return room ? everyoneSpent(room, this.store.players()) : false;
  });
  protected readonly timer = computed(() => {
    const total = this.seconds();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });
  private readonly origin = this.document.location.origin;
  protected readonly joinUrl = computed(() => `${this.origin}/join/${this.room().toUpperCase()}`);
  protected readonly streamUrl = computed(
    () => `${this.origin}/stream/${this.room().toUpperCase()}`,
  );

  constructor() {
    playGameSounds(this.store, this.sound);

    // Fetch the answer whenever a new question opens.
    effect(() => {
      const cellId = this.store.room()?.current_cell_id ?? null;
      // After a reload mid-question the check of the token finishes later than the room loads.
      const authorized = this.authorized();
      untracked(() => {
        this.answer.set(null);
        this.seconds.set(0);
        if (cellId && authorized) void this.loadAnswer();
      });
    });

    const tick = setInterval(() => this.seconds.update((s) => s + 1), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  async ngOnInit(): Promise<void> {
    const code = this.room().toUpperCase();
    this.token.set(this.local.hostToken(code) ?? '');
    await this.store.connect(code);
    const room = this.store.room();
    if (room && this.token()) {
      this.authorized.set(await this.api.isRoomHost(room.id, this.token()).catch(() => false));
    }
  }

  private async loadAnswer(): Promise<void> {
    const room = this.store.room();
    if (!room) return;
    this.answer.set(await this.api.hostAnswer(room.id, this.token()).catch(() => null));
  }

  protected act(
    action: 'startGame' | 'nextRound' | 'openBuzz' | 'returnToBoard' | 'skipQuestion',
  ): void {
    const room = this.store.room();
    if (room) void this.run(() => this.api[action](room.id, this.token()));
  }

  protected judge(correct: boolean): void {
    const room = this.store.room();
    if (room) void this.run(() => this.api.judge(room.id, this.token(), correct));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.toaster.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected openQuestion(cell: RoomCell): void {
    const room = this.store.room();
    if (room) void this.run(() => this.api.openQuestion(room.id, this.token(), cell.id));
  }

  protected closeAdjust(open: boolean): void {
    if (!open) this.adjusting.set(null);
  }

  protected applyDelta(event: Event, delta: number): void {
    event.preventDefault();
    const room = this.store.room();
    const player = this.adjusting();
    if (!room || !player || !Number.isInteger(delta) || delta === 0) return;
    void this.run(async () => {
      await this.api.adjustScore(room.id, this.token(), player.id, delta);
      this.adjusting.set(null);
    });
  }

  protected readonly finish = async (): Promise<void> => {
    const room = this.store.room();
    if (!room) return;
    await this.api.finishGame(room.id, this.token());
    this.finishing.set(false);
  };
}
