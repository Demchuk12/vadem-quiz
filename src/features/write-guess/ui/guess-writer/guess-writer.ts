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
import { RoomApi, RoomStore, type PlayerSession } from '@entities/room';
import { apiAction } from '@shared/api';
import { I18n, injectMessages, injectNumberFormat, parseNumber } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';
import { MESSAGES } from '../../i18n/messages';

/** The database takes numbers up to this, either way. */
const MAX_VALUE = 1e12;

/** A player's number for the current question, which they may change until the reveal. */
@Component({
  selector: 'vq-guess-writer',
  imports: [VdButton, VdField, VdInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './guess-writer.scss',
  templateUrl: './guess-writer.html',
})
export class GuessWriter {
  protected readonly t = injectMessages(MESSAGES);
  readonly session = input.required<PlayerSession>();

  private readonly store = inject(RoomStore);
  /** Only a new question resets the form, not every update of the room. */
  private readonly round = computed(() => this.store.room()?.round);
  private readonly api = inject(RoomApi);
  private readonly i18n = inject(I18n);
  private readonly action = apiAction();

  protected readonly format = injectNumberFormat();
  protected readonly busy = this.action.busy;
  protected readonly text = signal('');
  protected readonly tried = signal(false);
  /** What the database holds as this player's number for the round. */
  protected readonly sent = signal<number | null>(null);

  protected readonly value = computed(() => {
    const value = parseNumber(this.text(), this.i18n.locale());
    return value !== null && Math.abs(value) <= MAX_VALUE ? value : null;
  });
  /** Shown when it reads differently from what was typed: a comma may mean two things. */
  protected readonly understood = computed(() => {
    const value = this.value();
    if (value === null) return null;
    const shown = this.format(value);
    const plain = (text: string) => text.replace(/\s/gu, '').replace(/[−–]/gu, '-');
    return plain(shown) === plain(this.text()) ? null : shown;
  });
  protected readonly invalid = computed(() => this.tried() && this.value() === null);
  protected readonly unit = computed(() => this.store.room()?.guess_unit ?? null);
  protected readonly done = computed(() => this.store.room()?.guess_done.length ?? 0);
  protected readonly total = computed(() => this.store.players().length);

  constructor() {
    // A new question starts empty; a reloaded phone gets its number back.
    effect(() => {
      const round = this.round();
      const session = this.session();
      if (round === undefined) return;
      untracked(() => {
        this.sent.set(null);
        this.text.set('');
        this.tried.set(false);
        void this.api
          .guessMyValue(session.roomId, session.playerId, session.token)
          .then((value) => {
            // A number sent or typed meanwhile is newer than this reply, and so is a new question.
            if (value === null || this.round() !== round) return;
            if (this.sent() !== null || this.text() !== '') return;
            this.sent.set(value);
            this.text.set(this.format(value));
          })
          .catch(() => undefined);
      });
    });
  }

  protected type(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    const value = this.value();
    if (value === null) return;
    const session = this.session();
    const done = await this.action.run(() =>
      this.api.guessSubmit(session.roomId, session.playerId, session.token, value),
    );
    if (done) this.sent.set(value);
  }
}
