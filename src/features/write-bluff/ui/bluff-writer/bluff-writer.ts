import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoomApi, RoomStore, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';

/** The database takes up to this many characters for a lie. */
const MAX_LENGTH = 80;

/** A player's lie for the current fact, which they may change until the phase ends. */
@Component({
  selector: 'vq-bluff-writer',
  imports: [ReactiveFormsModule, VdButton, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bluff-writer.scss',
  templateUrl: './bluff-writer.html',
})
export class BluffWriter {
  readonly session = input.required<PlayerSession>();

  private readonly store = inject(RoomStore);
  private readonly api = inject(RoomApi);
  private readonly action = apiAction();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly busy = this.action.busy;
  /** What the database holds as this player's lie for the round. */
  protected readonly sent = signal<string | null>(null);
  protected readonly done = computed(() => this.store.room()?.bluff_done.length ?? 0);
  protected readonly total = computed(() => this.store.players().length);
  protected readonly form = inject(NonNullableFormBuilder).group({
    text: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_LENGTH)]],
  });

  constructor() {
    // A new fact starts empty; a reloaded phone gets its lie back.
    effect(() => {
      const round = this.store.room()?.round;
      const session = this.session();
      if (round === undefined) return;
      untracked(() => {
        this.sent.set(null);
        this.form.reset();
        void this.api
          .bluffMyRound(session.roomId, session.playerId, session.token)
          .then(({ answer }) => {
            this.sent.set(answer);
            if (answer) this.form.setValue({ text: answer });
          })
          .catch(() => undefined);
      });
    });
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const session = this.session();
    const text = this.form.controls.text.value.trim();
    const done = await this.action.run(() =>
      this.api.bluffSubmit(session.roomId, session.playerId, session.token, text),
    );
    if (done) this.sent.set(text);
  }
}
