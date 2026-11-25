import { computed, inject, type Signal } from '@angular/core';
import { I18n } from './i18n';
import { LOCALE_TAGS, type Locale } from './locale';

/** One slice's texts in every language. */
export type Messages<M> = Record<Locale, M>;

/**
 * Declares a slice's texts. Ukrainian sets the shape and every other language must match it, so a
 * missing translation, or a new language without one, does not compile. A text with values in it
 * is a function, which also leaves word order and plurals to the language.
 */
export function defineMessages<M>(
  messages: { uk: M } & Record<Exclude<Locale, 'uk'>, NoInfer<M>>,
): Messages<M> {
  return messages;
}

/** The slice's texts in the current language. Injection context. */
export function injectMessages<M>(messages: Messages<M>): Signal<M> {
  const { locale } = inject(I18n);
  return computed(() => messages[locale()]);
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** The form a count takes: 1 очко, 2 очки, 5 очок. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  return forms[new Intl.PluralRules(LOCALE_TAGS[locale]).select(count)] ?? forms.other;
}
