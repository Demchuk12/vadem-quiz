import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VD_ALERT } from '@vadem/ui/alert';
import { VdButton } from '@vadem/ui/button';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';
import { errorMessage } from '../../core/api-error';
import { GameApi } from '../../core/game-api';
import { LocalStore } from '../../core/local-store';

const CODE_LENGTH = 5;

@Component({
  selector: 'vq-join-page',
  imports: [ReactiveFormsModule, RouterLink, VD_ALERT, VdButton, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-8);
      max-inline-size: 26rem;
      margin-inline: auto;
      padding: var(--vd-space-6) var(--vd-space-4);
    }
    header {
      display: grid;
      gap: var(--vd-space-2);
    }
    h1 {
      font-size: var(--vd-text-3xl);
    }
    p {
      color: var(--vd-color-text-muted);
    }
    form {
      display: grid;
      gap: var(--vd-space-4);
    }
    .code {
      font-family: var(--vd-font-mono);
      letter-spacing: var(--vd-tracking-caps);
      text-transform: uppercase;
    }
    footer {
      padding-block-start: var(--vd-space-4);
      border-block-start: var(--vd-border-width) solid var(--vd-color-border);
    }
  `,
  template: `
    <header>
      <h1>Квіз із друзями</h1>
      <p>Введіть код кімнати від ведучого й оберіть нікнейм.</p>
    </header>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <vd-field label="Код кімнати" [error]="codeError">
        <input
          vdInput
          class="code"
          formControlName="code"
          size="lg"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          [attr.maxlength]="codeLength"
        />
      </vd-field>
      <vd-field label="Нікнейм" error="Вкажіть нікнейм, до 24 символів.">
        <input
          vdInput
          formControlName="nickname"
          size="lg"
          autocomplete="nickname"
          maxlength="24"
        />
      </vd-field>
      @if (error(); as message) {
        <div vdAlert variant="danger" role="alert">{{ message }}</div>
      }
      <button vdButton variant="primary" size="lg" type="submit" [loading]="busy()">
        Приєднатися
      </button>
    </form>

    <footer>
      <a vdButton variant="ghost" routerLink="/quizzes">Я ведучий</a>
    </footer>
  `,
})
export class JoinPage {
  /** From a shared link or QR code: /join/ABCDE. */
  readonly code = input<string>();

  private readonly api = inject(GameApi);
  private readonly local = inject(LocalStore);
  private readonly router = inject(Router);

  protected readonly codeLength = CODE_LENGTH;
  protected readonly codeError = `Код складається з ${CODE_LENGTH} символів.`;
  protected readonly busy = signal(false);
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
      const normalized = code.toUpperCase();
      this.form.controls.code.setValue(normalized);
      // A device that already joined this room goes straight back to the game.
      if (this.local.playerSession(normalized)) void this.router.navigate(['/play', normalized]);
    });
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const code = this.form.controls.code.value.trim().toUpperCase();
    this.busy.set(true);
    this.error.set(null);
    try {
      const joined = await this.api.joinRoom(code, this.form.controls.nickname.value);
      this.local.savePlayerSession(code, {
        roomId: joined.room_id,
        playerId: joined.player_id,
        token: joined.player_token,
      });
      await this.router.navigate(['/play', code]);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
