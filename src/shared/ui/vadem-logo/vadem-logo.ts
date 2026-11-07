import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** The brand as supplied: never recolor single blocks, rotate it, or add shadows. */
@Component({
  selector: 'vq-vadem-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './vadem-logo.scss',
  templateUrl: './vadem-logo.html',
})
export class VademLogo {
  /** Just the V, for tight headers. */
  readonly mark = input(false, { transform: booleanAttribute });
}
