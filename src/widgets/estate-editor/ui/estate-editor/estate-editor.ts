import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  ESTATE_LAYOUT,
  ESTATE_LIMITS,
  ESTATE_REGIONS,
  renameCell,
  renameRegion,
  setEnd,
  type EstateDocument,
  type EstateEnd,
} from '@entities/quiz';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { ClockSetting, Ornament } from '@shared/ui';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdInput } from '@vadem/ui/input';
import { VdSegment, VdSegmented } from '@vadem/ui/segmented';
import { MESSAGES } from '../../i18n/messages';
import { EstateDeckEditor } from '../estate-deck/estate-deck';

const ENDS: readonly EstateEnd[] = ['laps', 'minutes', 'last'];

/** A "Господар" quiz: the rules of a game, the names on the board and the two decks. */
@Component({
  selector: 'vq-estate-editor',
  imports: [
    ClockSetting,
    EstateDeckEditor,
    Ornament,
    VD_CARD,
    VdField,
    VdInput,
    VdSegment,
    VdSegmented,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-editor.scss',
  templateUrl: './estate-editor.html',
})
export class EstateEditor {
  protected readonly t = injectMessages(MESSAGES);
  readonly quiz = input.required<EstateDocument>();
  readonly quizChange = output<EstateDocument>();

  protected readonly format = injectNumberFormat();
  protected readonly limits = ESTATE_LIMITS;
  protected readonly layout = ESTATE_LAYOUT;
  protected readonly ends = ENDS;
  /** Each region with its cities, cheapest first, as they lie on the ring. */
  protected readonly regions = Array.from({ length: ESTATE_REGIONS }, (_, region) => ({
    region,
    cells: ESTATE_LAYOUT.flatMap((cell, i) => (cell.region === region ? [i] : [])),
  }));
  protected readonly others = ESTATE_LAYOUT.flatMap((cell, i) => (cell.kind === 'city' ? [] : [i]));

  protected money(amount: number): string {
    return `${this.format(amount)} ₴`;
  }

  protected kindOf(cell: number): string {
    const { kind, price } = ESTATE_LAYOUT[cell];
    const name = this.t().kinds[kind];
    return price > 0 ? `${name} · ${this.money(price)}` : name;
  }

  protected setTitle(event: Event): void {
    this.quizChange.emit({ ...this.quiz(), title: this.valueOf(event) });
  }

  protected setRegion(region: number, event: Event): void {
    this.quizChange.emit(renameRegion(this.quiz(), region, this.valueOf(event)));
  }

  protected setCell(cell: number, event: Event): void {
    this.quizChange.emit(renameCell(this.quiz(), cell, this.valueOf(event)));
  }

  protected setStartMoney(event: Event): void {
    const { min, max } = ESTATE_LIMITS.startMoney;
    const value = Math.round(Number(this.valueOf(event)));
    if (!Number.isFinite(value)) return;
    this.quizChange.emit({ ...this.quiz(), startMoney: Math.min(max, Math.max(min, value)) });
  }

  protected setEndKind(kind: EstateEnd): void {
    this.quizChange.emit(setEnd(this.quiz(), kind));
  }

  protected setEndValue(event: Event): void {
    const value = Number(this.valueOf(event));
    if (!Number.isFinite(value)) return;
    this.quizChange.emit(setEnd(this.quiz(), this.quiz().endKind, value));
  }

  protected setClock(turnSeconds: number | null): void {
    this.quizChange.emit({ ...this.quiz(), turnSeconds });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
