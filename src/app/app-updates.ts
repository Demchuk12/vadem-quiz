import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { injectMessages } from '@shared/i18n';
import { VdToaster } from '@vadem/ui/toast';
import { filter } from 'rxjs';
import { MESSAGES } from './i18n/messages';

/** Long enough to be noticed between questions, and the next visit gets the update anyway. */
const NOTICE_MS = 60_000;

/** Offers a new version without reloading by itself: a reload mid-question could cost the press. */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly t = injectMessages(MESSAGES);
  private readonly updates = inject(SwUpdate);
  private readonly toaster = inject(VdToaster);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  watch(): void {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() =>
        this.toaster.show({
          title: this.t().newVersion,
          duration: NOTICE_MS,
          action: { label: this.t().update, onClick: () => this.document.location.reload() },
        }),
      );
  }
}
