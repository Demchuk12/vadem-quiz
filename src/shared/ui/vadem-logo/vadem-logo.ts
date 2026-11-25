import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { Theme } from '../../lib';

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

  private readonly theme = inject(Theme);
  protected readonly src = computed(
    () => `brand/vadem-${this.mark() ? 'mark' : 'logo'}-${this.theme.name()}.svg`,
  );
}
