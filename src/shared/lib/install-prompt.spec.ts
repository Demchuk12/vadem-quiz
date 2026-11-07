import { TestBed } from '@angular/core/testing';
import { InstallPrompt } from './install-prompt';

function announce() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(event);
  return event;
}

describe('InstallPrompt', () => {
  it('offers nothing until the browser announces it', () => {
    expect(TestBed.inject(InstallPrompt).canPrompt()).toBe(false);
  });

  it('keeps the event from the browser mini-bar and opens it on request, once', async () => {
    const prompt = TestBed.inject(InstallPrompt);
    const event = announce();
    expect(event.defaultPrevented).toBe(true);
    expect(prompt.canPrompt()).toBe(true);

    await prompt.install();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(prompt.canPrompt()).toBe(false);
  });

  it('stops offering after the app is installed', () => {
    const prompt = TestBed.inject(InstallPrompt);
    announce();
    window.dispatchEvent(new Event('appinstalled'));
    expect(prompt.canPrompt()).toBe(false);
    expect(prompt.needsManualSteps()).toBe(false);
  });
});
