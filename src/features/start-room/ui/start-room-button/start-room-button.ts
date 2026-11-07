import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SavedQuizzes, type SavedQuiz } from '@entities/quiz';
import { RoomApi, RoomSessions } from '@entities/room';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';

@Component({
  selector: 'vq-start-room-button',
  imports: [VdButton, VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start-room-button.html',
})
export class StartRoomButton {
  readonly quiz = input.required<SavedQuiz>();

  private readonly api = inject(RoomApi);
  private readonly sessions = inject(RoomSessions);
  private readonly saved = inject(SavedQuizzes);
  private readonly router = inject(Router);
  private readonly action = apiAction();

  protected readonly busy = this.action.busy;

  protected async start(): Promise<void> {
    const quiz = this.quiz();
    await this.action.run(async () => {
      const room = await this.api.create(quiz.id, quiz.token);
      this.sessions.saveHostToken(room.room_code, room.host_token);
      this.saved.save({ ...quiz, lastRoomCode: room.room_code });
      await this.router.navigate(['/host', room.room_code]);
    });
  }
}
