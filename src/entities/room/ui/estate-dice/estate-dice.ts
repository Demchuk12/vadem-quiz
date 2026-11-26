import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  computed,
  input,
} from '@angular/core';
import { injectMessages } from '@shared/i18n';
import { MESSAGES } from '../../i18n/messages';

/** Which of the nine places of a die carry a pip, for each face. */
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The last throw: two dice. Nothing before the first. */
@Component({
  selector: 'vq-estate-dice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'label()', '[class.large]': 'large()' },
  styleUrl: './estate-dice.scss',
  templateUrl: './estate-dice.html',
})
export class EstateDice {
  protected readonly t = injectMessages(MESSAGES);
  readonly dice = input.required<readonly number[] | null>();
  readonly large = input(false, { transform: booleanAttribute });

  protected readonly faces = computed(() =>
    (this.dice() ?? []).map((value) =>
      Array.from({ length: 9 }, (_, i) => PIPS[value]?.includes(i)),
    ),
  );
  protected readonly label = computed(() => {
    const [a, b] = this.dice() ?? [];
    return a && b ? this.t().estate.dice(a, b) : null;
  });
}
