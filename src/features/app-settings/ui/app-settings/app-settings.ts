import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n, LOCALES, injectMessages } from '@shared/i18n';
import { THEMES, Theme } from '@shared/lib';
import { VdButton } from '@vadem/ui/button';
import { VdIcon } from '@vadem/ui/icon';
import { VdPopover, VdPopoverTrigger } from '@vadem/ui/popover';
import { VdSegment, VdSegmented } from '@vadem/ui/segmented';
import { LANGUAGES } from '../../config/languages';
import { MESSAGES } from '../../i18n/messages';

/** The app's language and theme, behind one quiet button: they are set once and forgotten. */
@Component({
  selector: 'vq-app-settings',
  imports: [VdButton, VdIcon, VdPopover, VdPopoverTrigger, VdSegment, VdSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app-settings.scss',
  templateUrl: './app-settings.html',
})
export class AppSettings {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly i18n = inject(I18n);
  protected readonly theme = inject(Theme);

  protected readonly locales = LOCALES;
  protected readonly languages = LANGUAGES;
  protected readonly themes = THEMES;
}
