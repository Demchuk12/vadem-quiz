import { inject } from '@angular/core';
import { I18n } from './i18n';
import { LOCALE_TAGS, type Locale } from './locale';

const formatOf = (locale: Locale, useGrouping: boolean) =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 3, useGrouping });
const FORMATS: Record<Locale, { plain: Intl.NumberFormat; grouped: Intl.NumberFormat }> = {
  uk: { plain: formatOf('uk', false), grouped: formatOf('uk', true) },
  en: { plain: formatOf('en', false), grouped: formatOf('en', true) },
};

/**
 * A number as the language writes it, with a typographic minus. Grouped from five digits on, so
 * that a year reads as a year: 1969, but 12 345.
 */
export function formatNumber(value: number, locale: Locale): string {
  const { plain, grouped } = FORMATS[locale];
  return (Math.abs(value) < 10_000 ? plain : grouped).format(value).replace('-', '−');
}

/** Numbers in the app's language. Injection context; the language is read when called. */
export function injectNumberFormat(): (value: number) => string {
  const { locale } = inject(I18n);
  return (value) => formatNumber(value, locale());
}

/**
 * A number as people type it: "1 234,5", "1,234.5", "−3". Null when it is not one. With both a dot
 * and a comma, the last is the decimal mark; one that repeats only groups. A lone comma before
 * exactly three digits is the one real ambiguity: English groups with it, Ukrainian does not.
 */
export function parseNumber(text: string, locale: Locale): number | null {
  let plain = text.replace(/[\s'’]/gu, '').replace(/^[−–-]/u, '-');
  const comma = plain.lastIndexOf(',');
  const dot = plain.lastIndexOf('.');
  const count = (mark: string) => plain.split(mark).length - 1;
  if (comma >= 0 && dot >= 0) {
    const group = comma > dot ? '.' : ',';
    plain = plain.split(group).join('');
    if (count(',') + count('.') > 1) return null;
  } else if (comma >= 0) {
    const groups = count(',') > 1 || (locale === 'en' && /^-?\d{1,3},\d{3}$/.test(plain));
    if (groups) plain = plain.split(',').join('');
  } else if (count('.') > 1) {
    plain = plain.split('.').join('');
  }
  plain = plain.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(plain) ? Number(plain) : null;
}
