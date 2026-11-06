import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VdToasterOutlet } from '@vadem/ui/toast';

@Component({
  selector: 'vq-root',
  imports: [RouterOutlet, VdToasterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <router-outlet />
    </main>
    <vd-toaster label="Сповіщення" closeLabel="Закрити" />
  `,
})
export class App {}
