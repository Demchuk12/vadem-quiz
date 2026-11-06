import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { VD_BOARD, type VdBoardCellState } from '@vadem/ui/board';
import type { BoardColumn } from '../game/game-logic';
import type { RoomCell } from '../game/models';

/** The board of the current round: buttons for the host, plain tiles for everyone else. */
@Component({
  selector: 'vq-game-board',
  imports: [VD_BOARD],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <vd-board [label]="label()" [rows]="rows()">
      @for (column of columns(); track column.title + $index) {
        <vd-board-column [heading]="column.title">
          @for (cell of column.cells; track cell.id) {
            @if (interactive()) {
              <button vdBoardCell [state]="stateOf(cell)" (click)="pick.emit(cell)">
                {{ cell.points }}
              </button>
            } @else {
              <div vdBoardCell [state]="stateOf(cell)">{{ cell.points }}</div>
            }
          }
        </vd-board-column>
      }
    </vd-board>
  `,
})
export class GameBoard {
  readonly columns = input.required<BoardColumn[]>();
  readonly rows = input.required<number>();
  readonly round = input.required<number>();
  readonly activeCellId = input<string | null>(null);
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly pick = output<RoomCell>();

  protected readonly label = computed(() => `Дошка, раунд ${this.round()}`);

  protected stateOf(cell: RoomCell): VdBoardCellState {
    if (cell.id === this.activeCellId()) return 'active';
    return cell.played ? 'played' : 'open';
  }
}
