import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HostSession, QuestionView, RoomApi, RoomStore, type HostAnswer } from '@entities/room';
import { QuestionControls } from '@features/run-question';
import { Media } from '@shared/api';

const TICK_MS = 1000;

/** The open question as the host sees it: with the answer, the controls and a stopwatch. */
@Component({
  selector: 'vq-host-question-panel',
  imports: [QuestionView, QuestionControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host-question-panel.scss',
  templateUrl: './host-question-panel.html',
})
export class HostQuestionPanel {
  protected readonly store = inject(RoomStore);
  protected readonly media = inject(Media);
  private readonly api = inject(RoomApi);
  private readonly host = inject(HostSession);

  protected readonly answer = signal<HostAnswer | null>(null);
  private readonly seconds = signal(0);
  protected readonly timer = computed(() => {
    const total = this.seconds();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    const cellId = computed(() => this.store.room()?.current_cell_id ?? null);
    effect(() => {
      const cell = cellId();
      this.answer.set(null);
      this.seconds.set(0);
      if (cell) void this.loadAnswer();
    });

    const tick = setInterval(() => this.seconds.update((s) => s + 1), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  private async loadAnswer(): Promise<void> {
    this.answer.set(await this.api.hostAnswer(this.host.key).catch(() => null));
  }
}
