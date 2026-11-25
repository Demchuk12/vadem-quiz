import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  input,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { RoomApi, RoomStore, buzzerStateFor, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { VdBuzzer, type VdBuzzerState } from '@vadem/ui/buzzer';
import { LateMeter } from '../late-meter/late-meter';
import { MESSAGES } from '../../i18n/messages';

const PRESS_VIBRATION_MS = 40;

/** The player's answer button. The server decides who was first; this only reports the press. */
@Component({
  selector: 'vq-buzz-button',
  imports: [VdBuzzer, LateMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './buzz-button.scss',
  templateUrl: './buzz-button.html',
})
export class BuzzButton {
  protected readonly t = injectMessages(MESSAGES);
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

  /** How late this player's press was, while someone else answers. */
  protected readonly lateMs = computed(() => {
    const room = this.store.room();
    if (room?.state !== 'buzzed') return null;
    const playerId = this.session().playerId;
    return room.late_presses?.find((press) => press.player_id === playerId)?.ms ?? null;
  });

  protected readonly label = computed(() => {
    const t = this.t();
    switch (this.state()) {
      case 'ready':
        // Someone just missed: the others get the floor.
        return this.store.verdict()?.correct === false ? t.yourChance : t.answer;
      case 'won':
        return t.youAnswer;
      case 'spent':
        return t.spent;
      case 'locked':
        if (this.pressing()) return t.sending;
        if (this.store.room()?.state === 'buzzed') {
          return t.answers(this.store.winner()?.nickname ?? t.someone);
        }
        return t.wait;
    }
  });

  protected async press(): Promise<void> {
    const session = this.session();
    this.document.defaultView?.navigator.vibrate?.(PRESS_VIBRATION_MS);
    // The outcome reaches the screen through the room's realtime update.
    await this.action.run(() => this.api.buzz(session.roomId, session.playerId, session.token));
  }
}
