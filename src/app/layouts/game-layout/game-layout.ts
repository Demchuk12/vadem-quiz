import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Game screens: the whole window belongs to the game, with no menu. */
@Component({
  selector: 'vq-game-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-layout.html',
})
export class GameLayout {}
