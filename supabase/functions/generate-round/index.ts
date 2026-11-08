// Fills one round of a quiz with AI-written questions. AI keys are secrets of this function, which is
// why it exists at all: the app has no other server, and a browser cannot keep a key.
// Secrets: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY. A provider without a key is not offered.
// Optional model overrides: GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GROQ_MODEL, GROQ_FALLBACK_MODEL,
// OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODEL.
//
// GET  -> { providers: [{ id, label }] }: the ones this deployment can use.
// POST -> { categories, provider }: one round, from the chosen provider or, with "auto", from the
//         first that answers. With `images`, some questions carry `imageUrl`: the free-licensed
//         lead photo of the Wikipedia article about the answer. The browser stores it with the
//         answer, so it shows only once the answer is revealed.
//         With `current`, the AI edits that content by the instruction in `prompt` instead: a
//         round, one category or one question, returned in the same shape.
//         With `own`, the host's own AIs (ChatGPT, Claude, Gemini, Groq, Mistral, OpenRouter)
//         write it: chosen as provider "own", or tried first under "auto". Their keys live in the
//         host's browser and pass through here per request, never stored and never logged.
// POST { action: "models", vendor, key } -> { models: [{ id, label }] }: what a key can use.

import { HEADERS } from './config.ts';
import { Failure } from './errors.ts';
import { generate } from './generate.ts';
import { attachImages } from './images.ts';
import { listModels } from './models.ts';
import { available } from './providers.ts';
import { consumeCall } from './quota.ts';
import { parseRequest } from './request.ts';

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method === 'GET') {
    return reply(200, { providers: available().map(({ id, label }) => ({ id, label })) });
  }
  if (req.method !== 'POST') return reply(405, { code: 'invalid_prompt' });

  try {
    const body = await req.json().catch(() => null);
    if (body?.action === 'models') {
      return reply(200, { models: (await listModels(body)).slice(0, 400) });
    }
    const request = parseRequest(body);
    await consumeCall(request);
    const { provider, ...round } = await generate(request);
    const pictures = request.images || request.current !== null;
    return reply(200, { ...(await attachImages(round, pictures)), provider });
  } catch (error) {
    if (error instanceof Failure) return reply(error.status, { code: error.code });
    console.error('generate-round failed', error);
    return reply(500, { code: 'ai_failed' });
  }
});
