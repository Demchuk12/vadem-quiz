import { DOCUMENT, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { injectMessages } from '../i18n/messages';
import { MESSAGES } from './i18n/messages';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a page inside the app. Closing the tab is covered by `beforeunload`. */
export const confirmUnsavedChanges: CanDeactivateFn<HasUnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  (inject(DOCUMENT).defaultView?.confirm(injectMessages(MESSAGES)().unsaved) ?? true);
