// Writes a round with the chosen AI, or with the first that answers.

import { ATTEMPT_TIMEOUT_MS, MIN_ATTEMPT_MS, RETRY_DELAY_MS, TIME_BUDGET_MS } from './config.ts';
import { Failure, Retryable } from './errors.ts';
import { withoutFlaws } from './flaws.ts';
import { available, ownProvider } from './providers.ts';
import type { GeneratedRound, RoundRequest } from './types.ts';

export async function generate(
  request: RoundRequest,
): Promise<GeneratedRound & { provider: string }> {
  const own = request.own.map(ownProvider);
  // The host's own AIs come first under "auto": they chose and pay for them.
  const providers =
    request.provider === 'own'
      ? own
      : request.provider === 'auto'
        ? [...own, ...available()]
        : available().filter((provider) => provider.id === request.provider);
  if (providers.length === 0) {
    console.error('No AI provider with a key for', request.provider);
    throw new Failure(500, 'ai_failed');
  }

  const startedAt = Date.now();
  let lastCode = 'ai_failed';
  const exhausted = new Set<string>();
  for (const provider of providers) {
    for (const [index, attempt] of provider.attempts().entries()) {
      if (exhausted.has(attempt.label)) continue;
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * index));
      const remaining = TIME_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < MIN_ATTEMPT_MS) throw new Failure(503, lastCode);
      try {
        const round = await attempt.run(request, Math.min(remaining, ATTEMPT_TIMEOUT_MS));
        const deadline = startedAt + TIME_BUDGET_MS;
        return {
          ...(await withoutFlaws(round, request, attempt, deadline)),
          provider: provider.id,
        };
      } catch (error) {
        // Under "auto", a key the provider refuses only skips that AI; chosen alone, it is news.
        if (
          error instanceof Failure &&
          (error.code === 'ai_key_invalid' || error.code === 'ai_no_credit') &&
          request.provider === 'auto'
        ) {
          break;
        }
        if (!(error instanceof Retryable)) throw error;
        lastCode = error.code;
        if (error.exhausted) exhausted.add(attempt.label);
      }
    }
  }
  throw new Failure(lastCode === 'ai_busy' ? 503 : 502, lastCode);
}
