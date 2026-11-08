// The daily limits on AI calls, kept by the database.

import { Failure } from './errors.ts';
import type { RoundRequest } from './types.ts';

/**
 * Proves the token and spends one call of the daily limit. Calls on the host's own keys have a
 * limit of their own and leave the shared free quota alone.
 */
export async function consumeCall(request: RoundRequest): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const counter = request.own.length > 0 ? 'consume_own_ai_call' : 'consume_ai_call';
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${counter}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey ?? '',
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_quiz_id: request.quizId, p_token: request.token }),
  });
  if (response.ok) return;

  const error = await response.json().catch(() => ({}));
  if (error.message === 'ai_limit') throw new Failure(429, 'ai_limit');
  if (error.message === 'not_authorized') throw new Failure(403, 'not_authorized');
  console.error('consume_ai_call failed', response.status, error);
  throw new Failure(502, 'ai_failed');
}
