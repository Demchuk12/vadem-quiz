import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VdToasterOutlet } from '@vadem/ui/toast';

@Component({
  selector: 'vq-root',
  imports: [RouterOutlet, VdToasterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {}
