import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VdIcon } from '@vadem/ui/icon';

/** The mark of an AI, or a branching arrow for "auto", which picks one. Decorative. */
@Component({
  selector: 'vq-ai-provider-icon',
  imports: [VdIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ai-provider-icon.scss',
  templateUrl: './ai-provider-icon.html',
  host: { 'aria-hidden': 'true' },
})
export class AiProviderIcon {
  readonly provider = input.required<string>();
}
