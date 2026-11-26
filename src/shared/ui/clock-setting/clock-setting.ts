import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { injectMessages } from '../../i18n';
import { VdField } from '@vadem/ui/field';
import { VD_NUMBER_INPUT } from '@vadem/ui/number-input';
import { VdSwitch } from '@vadem/ui/switch';
import { MESSAGES } from '../i18n/messages';

/** The shortest and longest clock a phase may have; the database checks the same. */
const MIN_SECONDS = 5;
const MAX_SECONDS = 300;

/** An optional clock: off means the host moves on by hand, on gives a number of seconds. */
@Component({
  selector: 'vq-clock-setting',
  imports: [VdField, VD_NUMBER_INPUT, VdSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './clock-setting.scss',
  templateUrl: './clock-setting.html',
})
export class ClockSetting {
  protected readonly t = injectMessages(MESSAGES);
  /** What the clock limits, as the switch says it: "Обмежити час на натискання". */
  readonly label = input.required<string>();
  readonly secondsLabel = input.required<string>();
  readonly value = input.required<number | null>();
  /** The seconds a clock gets when it is switched on. */
  readonly defaultSeconds = input.required<number>();
  /** The range of seconds, when a phase has its own. */
  readonly min = input(MIN_SECONDS);
  readonly max = input(MAX_SECONDS);
  /** What the page says with the clock off, when not that the host moves on. */
  readonly manualText = input<string | null>(null);
  readonly valueChange = output<number | null>();

  protected toggle(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.valueChange.emit(on ? this.defaultSeconds() : null);
  }

  protected set(event: Event): void {
    const seconds = Math.round(Number((event.target as HTMLInputElement).value));
    if (!Number.isFinite(seconds)) return;
    this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), seconds)));
  }
}
