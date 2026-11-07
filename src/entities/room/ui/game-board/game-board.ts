import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { VD_BOARD, type VdBoardCellState } from '@vadem/ui/board';
import type { RoomCell } from '../../model/room';
import { RoomStore } from '../../model/room-store';

/** The board of the current round: buttons for the host, plain tiles for everyone else. */
@Component({
  selector: 'vq-game-board',
  imports: [VD_BOARD],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-board.scss',
  templateUrl: './game-board.html',
})
export class GameBoard {
  /** For the host: tiles become buttons. Everyone else watches. */
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly pick = output<RoomCell>();

  protected readonly store = inject(RoomStore);
  protected readonly label = computed(() => `Дошка, раунд ${this.store.room()?.round ?? 1}`);

  protected stateOf(cell: RoomCell): VdBoardCellState {
    return cell.played ? 'played' : 'open';
  }
}
