import { inject, signal, type Signal } from '@angular/core';
import { VdToaster } from '@vadem/ui/toast';
import { errorMessage } from './api-error';

export interface ApiActionOptions {
  /** Shown above the message in the error toast. */
  errorTitle?: string;
  /** Replaces the toast, for a form that shows the failure itself. */
  onError?: (message: string) => void;
}

export interface ApiAction {
  readonly busy: Signal<boolean>;
  /** Ignored while another run is in flight. Resolves to whether the work succeeded. */
  run(work: () => Promise<unknown>, options?: ApiActionOptions): Promise<boolean>;
}

/** One user action against the server: blocks repeats and reports failures. Injection context. */
export function apiAction(): ApiAction {
  const toaster = inject(VdToaster);
  const busy = signal(false);

  return {
    busy: busy.asReadonly(),
    async run(work, options = {}) {
      if (busy()) return false;
      busy.set(true);
      try {
        await work();
        return true;
      } catch (error) {
        const message = errorMessage(error);
        if (options.onError) options.onError(message);
        else if (options.errorTitle) toaster.error(options.errorTitle, message);
        else toaster.error(message);
        return false;
      } finally {
        busy.set(false);
      }
    },
  };
}
