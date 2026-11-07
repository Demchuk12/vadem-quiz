import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
} from '@angular/core';
import { RoomApi, RoomStore, buzzerStateFor, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { VdBuzzer, type VdBuzzerState } from '@vadem/ui/buzzer';

const PRESS_VIBRATION_MS = 40;

/** The player's answer button. The server decides who was first; this only reports the press. */
@Component({
  selector: 'vq-buzz-button',
  imports: [VdBuzzer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './buzz-button.scss',
  templateUrl: './buzz-button.html',
})
export class BuzzButton {
  readonly session = input.required<PlayerSession>();

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly document = inject(DOCUMENT);

  private readonly action = apiAction();
  private readonly pressing = this.action.busy;

  protected readonly state = computed<VdBuzzerState>(() => {
    const room = this.store.room();
    if (!room) return 'locked';
    const state = buzzerStateFor(room, this.session().playerId);
    // Between the press and the server's reply the button must not take a second press.
    return this.pressing() && state === 'ready' ? 'locked' : state;
  });

  protected readonly label = computed(() => {
    switch (this.state()) {
      case 'ready':
        // Someone just missed: the others get the floor.
        return this.store.verdict()?.correct === false ? 'Ваш шанс!' : 'Відповісти!';
      case 'won':
        return 'Ви відповідаєте!';
      case 'spent':
        return 'Спробу використано';
      case 'locked':
        if (this.pressing()) return 'Надсилаємо…';
        if (this.store.room()?.state === 'buzzed') {
          return `${this.store.winner()?.nickname ?? 'Хтось'} відповідає`;
        }
        return 'Зачекайте';
    }
  });

  protected async press(): Promise<void> {
    const session = this.session();
    this.document.defaultView?.navigator.vibrate?.(PRESS_VIBRATION_MS);
    // The outcome reaches the screen through the room's realtime update.
    await this.action.run(() => this.api.buzz(session.roomId, session.playerId, session.token));
  }
}
