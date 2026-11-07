import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import qrcode from 'qrcode-generator';

const CELL_SIZE = 6;
const QUIET_ZONE_CELLS = 4;

/** Black on white whatever the theme: scanners need the contrast and the quiet zone. */
@Component({
  selector: 'vq-join-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './join-qr.scss',
  templateUrl: './join-qr.html',
})
export class JoinQr {
  readonly url = input.required<string>();

  protected readonly dataUrl = computed(() => {
    const code = qrcode(0, 'M');
    code.addData(this.url());
    code.make();
    return code.createDataURL(CELL_SIZE, CELL_SIZE * QUIET_ZONE_CELLS);
  });
}
