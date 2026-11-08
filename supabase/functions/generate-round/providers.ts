// The AIs: the free ones of this deployment and the host's own.

import { parseAnswer } from './answers.ts';
import { SITE_URL, VENDOR_LABELS } from './config.ts';
import { Failure } from './errors.ts';
import { post } from './http.ts';
import { instructions } from './prompt.ts';
import { GEMINI_SCHEMA, STRICT_SCHEMA } from './schemas.ts';
import type { Attempt, OwnAi, Provider, ProviderId, RoundRequest } from './types.ts';

export function gemini(
  model: string,
  key = Deno.env.get('GEMINI_API_KEY') ?? '',
  label = model,
): Attempt {
  return {
    label,
    async run(request, timeoutMs) {
      const data = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          headers: {
            'x-goog-api-key': key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions(request) }] },
            contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
            generationConfig: {
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: GEMINI_SCHEMA } },
            },
          }),
        },
        timeoutMs,
        label,
      );
      return parseAnswer(data?.candidates?.[0]?.content?.parts?.[0]?.text, request, label);
    },
  };
}

/** Groq and OpenRouter both speak the OpenAI chat format. */
export function openAiCompatible(
  url: string,
  key: string,
  model: string,
  responseFormat: unknown,
  extraHeaders: Record<string, string> = {},
  extraBody: (request: RoundRequest) => Record<string, unknown> = () => ({}),
  label = model,
): Attempt {
  return {
    label,
    async run(request, timeoutMs) {
      const data = await post(
        url,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: instructions(request) },
              { role: 'user', content: request.prompt },
            ],
            response_format: responseFormat,
            ...extraBody(request),
          }),
        },
        timeoutMs,
        label,
      );
      return parseAnswer(data?.choices?.[0]?.message?.content, request, label);
    },
  };
}

/** Claude answers through a tool call, which holds it to the schema. */
export function anthropic(model: string, key: string, label: string): Attempt {
  return {
    label,
    async run(request, timeoutMs) {
      const data = await post(
        'https://api.anthropic.com/v1/messages',
        {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            system: instructions(request),
            messages: [{ role: 'user', content: request.prompt }],
            tools: [
              {
                name: 'write_round',
                description: 'Hands over the written round.',
                input_schema: STRICT_SCHEMA,
              },
            ],
            tool_choice: { type: 'tool', name: 'write_round' },
          }),
        },
        timeoutMs,
        label,
      );
      const call = (data?.content ?? []).find(
        (block: { type?: string }) => block?.type === 'tool_use',
      );
      return parseAnswer(call ? JSON.stringify(call.input) : undefined, request, label);
    },
  };
}

/** One of the host's own AIs, on their key: any model they chose, paid ones included. */
export function ownProvider(own: OwnAi, index: number): Provider {
  const label = `own:${index}`;
  const strict = {
    type: 'json_schema',
    json_schema: { name: 'round', strict: true, schema: STRICT_SCHEMA },
  };
  const attempt = (): Attempt => {
    switch (own.vendor) {
      case 'openai':
        return openAiCompatible(
          'https://api.openai.com/v1/chat/completions',
          own.key,
          own.model,
          strict,
          {},
          () => ({}),
          label,
        );
      case 'anthropic':
        return anthropic(own.model, own.key, label);
      case 'gemini':
        return gemini(own.model, own.key, label);
      case 'groq':
        // Groq holds only its gpt-oss models to a strict schema; the rest take JSON mode.
        return own.model.includes('gpt-oss')
          ? openAiCompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              own.key,
              own.model,
              strict,
              {},
              (request) => ({
                reasoning_effort: request.categories * request.questions <= 8 ? 'medium' : 'low',
              }),
              label,
            )
          : openAiCompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              own.key,
              own.model,
              { type: 'json_object' },
              {},
              () => ({}),
              label,
            );
      case 'mistral':
        return openAiCompatible(
          'https://api.mistral.ai/v1/chat/completions',
          own.key,
          own.model,
          { type: 'json_object' },
          {},
          () => ({}),
          label,
        );
      case 'openrouter':
        return openAiCompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          own.key,
          own.model,
          { type: 'json_object' },
          { 'HTTP-Referer': SITE_URL, 'X-Title': 'Vadem Quiz' },
          () => ({}),
          label,
        );
    }
  };
  return { id: label, label: VENDOR_LABELS[own.vendor], attempts: () => [attempt(), attempt()] };
}

/** In the order "auto" tries them. */
export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    attempts: () => {
      const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
      const fallback = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
      return [gemini(model), gemini(model), gemini(fallback)];
    },
  },
  {
    id: 'groq',
    label: 'Groq',
    attempts: () => {
      // gpt-oss reasons before it answers. Low effort keeps a round well inside the free
      // tokens-per-minute limit and stops long rounds from being cut off; a small edit can
      // afford more thought, which keeps its facts straight.
      const groq = (model: string) =>
        openAiCompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          Deno.env.get('GROQ_API_KEY') ?? '',
          model,
          {
            type: 'json_schema',
            json_schema: { name: 'round', strict: true, schema: STRICT_SCHEMA },
          },
          {},
          (request) => ({
            reasoning_effort: request.categories * request.questions <= 8 ? 'medium' : 'low',
          }),
        );
      const model = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
      // The smaller model has limits of its own, so it stands in when the main one is used up.
      const fallback = Deno.env.get('GROQ_FALLBACK_MODEL') ?? 'openai/gpt-oss-20b';
      return [groq(model), groq(model), groq(fallback)];
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    attempts: () => {
      // A free model is shared by everyone and often rate-limited, so OpenRouter's free router,
      // which picks whichever free model is available, stands by. Gemma takes only JSON mode.
      const models: [string, unknown][] = [
        [Deno.env.get('OPENROUTER_MODEL') ?? 'google/gemma-4-31b-it:free', { type: 'json_object' }],
        [
          Deno.env.get('OPENROUTER_FALLBACK_MODEL') ?? 'openrouter/free',
          {
            type: 'json_schema',
            json_schema: { name: 'round', strict: true, schema: STRICT_SCHEMA },
          },
        ],
      ];
      // Only free models: a paid one would spend the account's credits.
      const free = (model: string) => model.endsWith(':free') || model === 'openrouter/free';
      if (!models.every(([model]) => free(model))) throw new Failure(500, 'ai_failed');
      return models.map(([model, format]) =>
        openAiCompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          Deno.env.get('OPENROUTER_API_KEY') ?? '',
          model,
          format,
          { 'HTTP-Referer': SITE_URL, 'X-Title': 'Vadem Quiz' },
        ),
      );
    },
  },
];

export const KEYS: Record<ProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export const available = () =>
  PROVIDERS.filter((provider) => !!Deno.env.get(KEYS[provider.id as ProviderId]));
