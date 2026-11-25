import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { storedSetting } from '../lib/stored-setting';
import { LOCALE_KEY, isLocale, preferredLocale, type Locale } from './locale';

/** The language of the app on this device. Switching it changes every open screen at once. */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  private readonly setting = storedSetting<Locale>(
    LOCALE_KEY,
    isLocale,
    preferredLocale(this.document.defaultView?.navigator.languages ?? []),
  );

  readonly locale = this.setting.value;

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.locale();
    });
  }

  use(locale: Locale): void {
    this.setting.set(locale);
  }
}
