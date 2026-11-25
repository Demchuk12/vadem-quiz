import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { injectMessages } from '@shared/i18n';
import { RoomApi, RoomSessions, normalizeRoomCode } from '@entities/room';
import { apiAction } from '@shared/api';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';
import { MESSAGES } from '../../i18n/messages';

const CODE_LENGTH = 5;

@Component({
  selector: 'vq-join-form',
  imports: [ReactiveFormsModule, VD_ALERT, VdButton, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './join-form.scss',
  templateUrl: './join-form.html',
})
export class JoinForm {
  protected readonly t = injectMessages(MESSAGES);
  /** From a shared link or QR code: /join/ABCDE. */
  readonly code = input<string>();

  private readonly api = inject(RoomApi);
  private readonly sessions = inject(RoomSessions);
  private readonly router = inject(Router);

  protected readonly codeLength = CODE_LENGTH;
  private readonly action = apiAction();
  protected readonly busy = this.action.busy;
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: [
      '',
      [Validators.required, Validators.minLength(CODE_LENGTH), Validators.maxLength(CODE_LENGTH)],
    ],
    nickname: ['', [Validators.required, Validators.maxLength(24), Validators.pattern(/\S/)]],
  });

  constructor() {
    effect(() => {
      const code = this.code();
      if (!code) return;
      const normalized = normalizeRoomCode(code);
      this.form.controls.code.setValue(normalized);
      // A device that already joined this room goes straight back to the game.
      if (this.sessions.player(normalized)) void this.router.navigate(['/play', normalized]);
    });
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const code = normalizeRoomCode(this.form.controls.code.value);
    this.error.set(null);
    await this.action.run(
      async () => {
        const joined = await this.api.join(code, this.form.controls.nickname.value);
        this.sessions.savePlayer(code, {
          roomId: joined.room_id,
          playerId: joined.player_id,
          token: joined.player_token,
        });
        await this.router.navigate(['/play', code]);
      },
      { onError: (message) => this.error.set(message) },
    );
  }
}
