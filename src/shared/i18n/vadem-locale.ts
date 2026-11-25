import { inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { VD_LOCALE, vdLocaleEn, vdLocaleUk } from '@vadem/ui/locale';
import { I18n } from './i18n';
import type { Locale } from './locale';

const VADEM = { uk: vdLocaleUk, en: vdLocaleEn } satisfies Record<Locale, typeof vdLocaleUk>;
type VademLocale = typeof vdLocaleUk;

/**
 * Vadem's own texts in the app's language. Its components take their section once, when created,
 * and read the texts from it later inside a computed, so a section that looks the language up on
 * every read switches with the app.
 */
export function provideVademLocale(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: VD_LOCALE,
      useFactory: (): VademLocale => {
        const { locale } = inject(I18n);
        const section = (name: keyof VademLocale) =>
          new Proxy({}, { get: (_, key) => Reflect.get(VADEM[locale()][name] as object, key) });
        return new Proxy({} as VademLocale, {
          get: (_, name: keyof VademLocale) =>
            typeof vdLocaleUk[name] === 'object' ? section(name) : VADEM[locale()][name],
        });
      },
    },
  ]);
}
