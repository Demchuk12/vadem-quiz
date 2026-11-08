// Talks to AI providers and sorts their failures.

import { Failure, Retryable } from './errors.ts';

/** The host's own AIs are named "own:N" in logs, and their replies are never logged. */
export const isOwn = (name: string) => name.startsWith('own:');

/** What the provider said, for the logs: nothing at all for the host's own keys. */
export async function detail(response: Response, name: string, length: number): Promise<string> {
  return isOwn(name) ? '' : (await response.text()).slice(0, length);
}

/**
 * Why a provider turned a request down, from its error body, safe to log: keys are blanked out in
 * case a provider quotes one.
 */
export async function providerReason(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  let reason = text;
  try {
    const error = JSON.parse(text)?.error;
    reason = [error?.type ?? error?.status ?? error?.code, error?.message]
      .filter(Boolean)
      .join(': ');
  } catch {
    // Not JSON: keep the text.
  }
  return reason
    .replace(/sk-[\w-]{6,}/g, 'sk-***')
    .replace(/AIza[\w-]{10,}/g, 'AIza***')
    .slice(0, 300);
}

/** Most providers say 401 or 403 to a bad key; Google says 400 and names the reason. */
export async function refusesKey(response: Response): Promise<boolean> {
  if (response.status === 401 || response.status === 403) return true;
  if (response.status !== 400) return false;
  const text = await response.clone().text();
  return /API_KEY_INVALID|API key not valid/i.test(text);
}

/** Sends a request and sorts its failures: busy or broken means try again or elsewhere. */
export async function post(url: string, init: RequestInit, timeoutMs: number, name: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error(name, 'did not answer', isOwn(name) ? '' : error);
    throw new Retryable('ai_busy');
  }
  // A key the provider refuses will not work on the next try either.
  if (isOwn(name) && (await refusesKey(response))) {
    console.error(name, 'refused the key', response.status);
    throw new Failure(400, 'ai_key_invalid');
  }
  if (isOwn(name) && !response.ok) {
    const reason = await providerReason(response);
    console.error(name, 'failed', response.status, reason);
    // An empty balance will not fill up on the next try.
    if (/credit|billing|quota|payment|insufficient/i.test(reason)) {
      throw new Failure(402, 'ai_no_credit');
    }
    if (response.status === 429 || response.status >= 500) {
      throw new Retryable('ai_busy', response.status === 429);
    }
    throw new Retryable('ai_failed');
  }
  if (response.status === 429 || response.status >= 500) {
    console.error(name, 'busy', response.status, await detail(response, name, 300));
    throw new Retryable('ai_busy', response.status === 429);
  }
  if (!response.ok) {
    console.error(name, 'failed', response.status, await detail(response, name, 500));
    throw new Retryable('ai_failed');
  }
  // The timeout covers reading the body too.
  return response.json().catch((error) => {
    console.error(name, 'answer cut off', String(error));
    throw new Retryable('ai_busy');
  });
}
