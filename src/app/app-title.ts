import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { injectMessages } from '@shared/i18n';
import { MESSAGES } from './i18n/messages';

/** The tab's title in the app's language, changing with it: a route only names the text. */
@Injectable({ providedIn: 'root' })
export class AppTitle extends TitleStrategy {
  private readonly t = injectMessages(MESSAGES);
  private readonly title = inject(Title);
  private readonly key = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const { name, titles } = this.t();
      const page = titles[this.key() ?? ''];
      this.title.setTitle(page ? `${page} · ${name}` : name);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
  }
}
