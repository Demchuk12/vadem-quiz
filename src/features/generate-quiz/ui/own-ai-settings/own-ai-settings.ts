import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { injectMessages } from '@shared/i18n';
import {
  AiProviderIcon,
  QuizWriter,
  QuizApi,
  VENDOR_LABELS,
  type AiModel,
  type AiVendor,
} from '@entities/quiz';
import { apiAction } from '@shared/api';
import { VdButton } from '@vadem/ui/button';
import { VD_DIALOG } from '@vadem/ui/dialog';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VD_PASSWORD_INPUT } from '@vadem/ui/password-input';
import { VdCombobox, VdOption, VdSelect } from '@vadem/ui/select';
import { VdToaster } from '@vadem/ui/toast';
import { VENDORS, type Vendor } from '../../config/vendors';
import { MESSAGES } from '../../i18n/messages';

/**
 * Connects the host's own AIs by key: pick the company, paste the key, check it, pick a model.
 * The key stays in this browser; it only passes through the function with each request.
 */
@Component({
  selector: 'vq-own-ai-settings',
  imports: [
    AiProviderIcon,
    VdButton,
    VD_DIALOG,
    VdField,
    VdIcon,
    VD_PASSWORD_INPUT,
    VdCombobox,
    VdOption,
    VdSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './own-ai-settings.scss',
  templateUrl: './own-ai-settings.html',
})
export class OwnAiSettings {
  protected readonly t = injectMessages(MESSAGES);
  protected readonly ai = inject(QuizWriter);
  private readonly api = inject(QuizApi);
  private readonly toaster = inject(VdToaster);
  private readonly checking = apiAction();

  protected readonly vendors = VENDORS;
  protected readonly vendorLabels = VENDOR_LABELS;
  protected readonly open = signal(false);
  /** Gemini first: free on the host's own key, and the strongest in our tests. */
  protected readonly vendor = signal<AiVendor>('gemini');
  protected readonly key = signal('');
  protected readonly models = signal<AiModel[] | null>(null);
  protected readonly model = signal<string | null>(null);
  protected readonly busy = this.checking.busy;
  protected readonly keyError = signal('');

  protected readonly keysUrl = computed(
    () => VENDORS.find((vendor) => vendor.id === this.vendor())?.keysUrl ?? '',
  );

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected vendorName(vendor: Vendor): string {
    return vendor.free ? `${vendor.label}, ${this.t().free}` : vendor.label;
  }

  protected setVendor(vendor: AiVendor): void {
    this.vendor.set(vendor);
    this.reset();
  }

  protected setKey(key: string): void {
    this.key.set(key.trim());
    this.models.set(null);
    this.model.set(null);
    this.keyError.set('');
  }

  /** Asks the provider which models the key may use; that also proves the key works. */
  protected async check(): Promise<void> {
    if (this.key().length < 8) {
      this.keyError.set(this.t().ownAi.keyShort);
      return;
    }
    await this.checking.run(
      async () => {
        const models = await this.api.aiModels(this.vendor(), this.key());
        this.models.set(models);
        this.model.set(models[0]?.id ?? null);
      },
      { onError: (message) => this.keyError.set(message) },
    );
  }

  protected add(): void {
    const model = this.models()?.find((m) => m.id === this.model());
    if (!model) return;
    this.ai.addOwn({
      vendor: this.vendor(),
      key: this.key(),
      model: model.id,
      modelLabel: model.label,
    });
    this.toaster.success(
      this.t().ownAi.done,
      this.t().ownAi.doneText(this.ai.labelOf(this.ai.provider())),
    );
    this.reset();
    this.open.set(false);
  }

  private reset(): void {
    this.key.set('');
    this.models.set(null);
    this.model.set(null);
    this.keyError.set('');
  }
}
