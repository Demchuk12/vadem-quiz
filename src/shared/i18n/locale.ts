export const LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** For `Intl`: how numbers look. */
export const LOCALE_TAGS: Record<Locale, string> = { uk: 'uk-UA', en: 'en-US' };

export const LOCALE_KEY = 'vq.locale';

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/**
 * The language of a first visit. Many Ukrainian speakers keep an English device, so Ukrainian
 * anywhere among the browser's languages wins; everyone else gets English.
 */
export function preferredLocale(languages: readonly string[]): Locale {
  return languages.some((language) => /^uk\b/i.test(language)) ? 'uk' : 'en';
}
