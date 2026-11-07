import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Kind = 'question' | 'tile' | 'dot';
const KINDS: readonly Kind[] = ['question', 'tile', 'dot', 'tile'];

/**
 * A burst of the quiz's own confetti: question marks, board tiles and dots in the game colors.
 * It fires once when it appears; under reduced motion it does not show at all. Decorative.
 */
@Component({
  selector: 'vq-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './confetti.scss',
  templateUrl: './confetti.html',
  host: { 'aria-hidden': 'true' },
})
export class Confetti {
  readonly count = input(24);
  /** How far the pieces fly, in rem. */
  readonly spread = input(14);

  /** Even angles at a few distances, so the burst does not look drawn with a compass. */
  protected readonly pieces = computed(() => {
    const count = this.count();
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * 2 * Math.PI + (index % 2) * 0.2;
      const distance = this.spread() * (0.55 + (index % 3) * 0.22);
      return {
        kind: KINDS[index % KINDS.length]!,
        tone: index % 5 === 0 ? 'amber' : index % 3 === 0 ? 'mint' : 'green',
        x: `${(Math.cos(angle) * distance).toFixed(2)}rem`,
        y: `${(Math.sin(angle) * distance * 0.7).toFixed(2)}rem`,
        turn: `${((index % 2 ? 1 : -1) * (120 + (index % 4) * 60)).toFixed(0)}deg`,
        delay: `${(index % 4) * 35}ms`,
      };
    });
  });
}
