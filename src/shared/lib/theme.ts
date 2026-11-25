import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { storedSetting } from './stored-setting';

export const THEMES = ['dark', 'light'] as const;
export type ThemeName = (typeof THEMES)[number];

/** index.html reads the same key before the app starts, so the first paint is already right. */
const THEME_KEY = 'vq.theme';

/** The browser's own bars, matched to the page's background. index.html repeats these too. */
const BAR_COLORS: Record<ThemeName, string> = { dark: '#0a100c', light: '#f4f8f6' };

const isTheme = (value: unknown): value is ThemeName => THEMES.includes(value as ThemeName);

/** The colors of the app on this device. Dark is the game's own look, so it is the default. */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly setting = storedSetting<ThemeName>(THEME_KEY, isTheme, 'dark');

  readonly name = this.setting.value;

  constructor() {
    effect(() => {
      const name = this.name();
      this.document.documentElement.dataset['theme'] = name;
      this.document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', BAR_COLORS[name]);
    });
  }

  use(name: ThemeName): void {
    this.setting.set(name);
  }
}
