import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

/** Chromium's install event, which is not part of the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Whether the app can be installed here, and how. Inject early: the browser announces it once. */
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installed = signal(
    this.window?.matchMedia?.('(display-mode: standalone)').matches ?? false,
  );

  /** The browser has its own install dialog that a button can open. */
  readonly canPrompt = computed(() => this.deferred() !== null && !this.installed());
  /** iOS has no such dialog: installing is only possible from Safari's Share menu. */
  readonly needsManualSteps = computed(
    () => !this.installed() && /iphone|ipad|ipod/i.test(this.window?.navigator.userAgent ?? ''),
  );

  constructor() {
    this.window?.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred.set(event as BeforeInstallPromptEvent);
    });
    this.window?.addEventListener('appinstalled', () => {
      this.deferred.set(null);
      this.installed.set(true);
    });
  }

  async install(): Promise<void> {
    const event = this.deferred();
    if (!event) return;
    await event.prompt();
    // An install event works only once, whatever the person answered.
    await event.userChoice;
    this.deferred.set(null);
  }
}
