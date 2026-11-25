import { DOCUMENT, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { readJson, writeJson } from './local-storage';

export interface StoredSetting<T> {
  readonly value: Signal<T>;
  set(value: T): void;
}

/**
 * A preference of this browser. Other open tabs follow a change at once: the host's panel and the
 * stream's screen are often open side by side. Injection context.
 */
export function storedSetting<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): StoredSetting<T> {
  const read = () => {
    const stored = readJson<unknown>(key);
    return isValid(stored) ? stored : fallback;
  };
  const value = signal(read());

  const view = inject(DOCUMENT).defaultView;
  const follow = (event: StorageEvent) => {
    if (event.key === key) value.set(read());
  };
  view?.addEventListener('storage', follow);
  inject(DestroyRef).onDestroy(() => view?.removeEventListener('storage', follow));

  return {
    value: value.asReadonly(),
    set(next) {
      value.set(next);
      writeJson(key, next);
    },
  };
}
