import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VdAlertDialog } from '@vadem/ui/alert-dialog';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VD_EMPTY_STATE } from '@vadem/ui/empty-state';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage, isApiError } from '../../core/api-error';
import { GameApi } from '../../core/game-api';
import { LocalStore, type SavedQuiz } from '../../core/local-store';
import { emptyQuiz } from '../../game/quiz-document';

@Component({
  selector: 'vq-quizzes-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    VdAlertDialog,
    VdButton,
    VD_CARD,
    VD_EMPTY_STATE,
    VdField,
    VdIcon,
    VdInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      gap: var(--vd-space-6);
      max-inline-size: 48rem;
      margin-inline: auto;
      padding: var(--vd-space-6) var(--vd-space-4);
    }
    h1 {
      font-size: var(--vd-text-3xl);
    }
    .hint {
      color: var(--vd-color-text-muted);
    }
    form {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-3);
      align-items: end;
    }
    form vd-field {
      flex: 1 1 14rem;
    }
    ul {
      display: grid;
      gap: var(--vd-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-3);
      align-items: center;
      justify-content: space-between;
    }
    .title {
      min-inline-size: 0;
      font-weight: var(--vd-weight-semibold);
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--vd-space-2);
    }
  `,
  template: `
    <header>
      <h1>Мої квізи</h1>
      <p class="hint">
        Квізи привʼязані до цього пристрою: доступ зберігається в браузері, акаунтів немає. Щоб не
        втратити квіз, експортуйте його в JSON.
      </p>
    </header>

    <form [formGroup]="form" (ngSubmit)="create()">
      <vd-field label="Назва нового квізу" error="Вкажіть назву.">
        <input vdInput formControlName="title" maxlength="120" />
      </vd-field>
      <button vdButton variant="primary" type="submit" [loading]="creating()">
        <vd-icon slot="start" name="plus" />
        Створити
      </button>
    </form>

    @if (quizzes().length === 0) {
      <div vdEmptyState icon="folder">
        <p vdEmptyStateTitle>Квізів поки немає</p>
        <p vdEmptyStateDescription>Створіть перший, щоб зібрати питання й запустити гру.</p>
      </div>
    } @else {
      <ul>
        @for (quiz of quizzes(); track quiz.id) {
          <li vdCard>
            <div class="row">
              <span class="title">{{ quiz.title }}</span>
              <div class="actions">
                @if (quiz.lastRoomCode; as code) {
                  <a vdButton size="sm" [routerLink]="['/host', code]">Гра {{ code }}</a>
                }
                <button
                  vdButton
                  size="sm"
                  variant="primary"
                  [loading]="startingId() === quiz.id"
                  (click)="start(quiz)"
                >
                  <vd-icon slot="start" name="rocket" />
                  Нова гра
                </button>
                <a vdButton size="sm" [routerLink]="['/quizzes', quiz.id]">
                  <vd-icon slot="start" name="pencil" />
                  Редагувати
                </a>
                <button
                  vdButton
                  size="sm"
                  variant="ghost"
                  iconOnly
                  [attr.aria-label]="'Видалити: ' + quiz.title"
                  (click)="deleting.set(quiz)"
                >
                  <vd-icon name="trash" />
                </button>
              </div>
            </div>
          </li>
        }
      </ul>
    }

    <vd-alert-dialog
      title="Видалити квіз?"
      [description]="
        '«' + (deleting()?.title ?? '') + '» зникне назавжди. Ігри, що вже йдуть, не постраждають.'
      "
      confirmLabel="Видалити"
      cancelLabel="Скасувати"
      variant="danger"
      [open]="deleting() !== null"
      [action]="remove"
      (openChange)="$event || deleting.set(null)"
    />
  `,
})
export class QuizzesPage {
  private readonly api = inject(GameApi);
  private readonly local = inject(LocalStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(VdToaster);

  protected readonly quizzes = signal(this.local.quizzes());
  protected readonly creating = signal(false);
  protected readonly startingId = signal<string | null>(null);
  protected readonly deleting = signal<SavedQuiz | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
  });

  protected async create(): Promise<void> {
    if (this.creating()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const title = this.form.controls.title.value.trim();
    this.creating.set(true);
    try {
      const quiz = await this.api.createQuiz(title);
      await this.api.saveQuiz(quiz.quiz_id, quiz.owner_token, emptyQuiz(title));
      this.local.saveQuiz({ id: quiz.quiz_id, token: quiz.owner_token, title });
      await this.router.navigate(['/quizzes', quiz.quiz_id]);
    } catch (error) {
      this.toaster.error(errorMessage(error));
    } finally {
      this.creating.set(false);
    }
  }

  protected async start(quiz: SavedQuiz): Promise<void> {
    if (this.startingId()) return;
    this.startingId.set(quiz.id);
    try {
      const room = await this.api.createRoom(quiz.id, quiz.token);
      this.local.saveHostToken(room.room_code, room.host_token);
      this.local.saveQuiz({ ...quiz, lastRoomCode: room.room_code });
      await this.router.navigate(['/host', room.room_code]);
    } catch (error) {
      if (isApiError(error, 'quiz_incomplete')) {
        this.toaster.error('Квіз ще не заповнено', errorMessage(error));
      } else {
        this.toaster.error(errorMessage(error));
      }
    } finally {
      this.startingId.set(null);
    }
  }

  protected readonly remove = async (): Promise<void> => {
    const quiz = this.deleting();
    if (!quiz) return;
    await this.api.deleteQuiz(quiz.id, quiz.token);
    this.local.forgetQuiz(quiz.id);
    this.quizzes.set(this.local.quizzes());
    this.deleting.set(null);
  };
}
