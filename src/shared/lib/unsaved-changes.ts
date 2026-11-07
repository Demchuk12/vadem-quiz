import { DOCUMENT, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a page inside the app. Closing the tab is covered by `beforeunload`. */
export const confirmUnsavedChanges: CanDeactivateFn<HasUnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  (inject(DOCUMENT).defaultView?.confirm('Є незбережені зміни. Вийти без збереження?') ?? true);
