import { TestBed } from '@angular/core/testing';
import { VD_LOCALE } from '@vadem/ui/locale';
import { I18n } from './i18n';
import { preferredLocale } from './locale';
import { defineMessages, injectMessages, plural } from './messages';
import { provideVademLocale } from './vadem-locale';

const TEXTS = defineMessages({
  uk: { hello: 'Привіт', left: (count: number) => `Лишилось ${count}` },
  en: { hello: 'Hello', left: (count) => `${count} left` },
});

describe('i18n', () => {
  beforeEach(() => localStorage.clear());

  it('picks Ukrainian when the browser knows it at all, English otherwise', () => {
    expect(preferredLocale(['en-US', 'uk'])).toBe('uk');
    expect(preferredLocale(['uk-UA'])).toBe('uk');
    expect(preferredLocale(['de-DE', 'en-US'])).toBe('en');
    expect(preferredLocale([])).toBe('en');
  });

  it('switches texts at once and remembers the choice', () => {
    const i18n = TestBed.inject(I18n);
    const t = TestBed.runInInjectionContext(() => injectMessages(TEXTS));
    i18n.use('uk');
    expect(t().hello).toBe('Привіт');
    i18n.use('en');
    expect(t().left(3)).toBe('3 left');
    expect(localStorage.getItem('vq.locale')).toBe('"en"');
  });

  it('follows a change made in another tab', () => {
    const i18n = TestBed.inject(I18n);
    i18n.use('uk');
    localStorage.setItem('vq.locale', '"en"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'vq.locale' }));
    expect(i18n.locale()).toBe('en');
  });

  it('keeps a texts section of Vadem in step with the language', () => {
    TestBed.configureTestingModule({ providers: [provideVademLocale()] });
    const i18n = TestBed.inject(I18n);
    // Vadem's components take their section once and read it later.
    const section = TestBed.inject(VD_LOCALE).alertDialog;
    i18n.use('uk');
    const ukrainian = section.cancelLabel;
    i18n.use('en');
    expect(section.cancelLabel).toBe('Cancel');
    expect(ukrainian).not.toBe('Cancel');
  });

  it('takes the plural form of the language', () => {
    const forms = { one: 'очко', few: 'очки', other: 'очок' };
    expect([1, 3, 5, 21].map((n) => plural('uk', n, forms))).toEqual([
      'очко',
      'очки',
      'очок',
      'очко',
    ]);
  });
});
