// The models a host's key opens.

import { Failure } from './errors.ts';
import { refusesKey } from './http.ts';
import { isKey, isVendor } from './request.ts';

/** The chat models a key may use, newest first, so the host can pick one. */
export async function listModels(
  body: Record<string, unknown>,
): Promise<{ id: string; label: string }[]> {
  const { vendor, key } = body;
  if (!isVendor(vendor) || !isKey(key)) throw new Failure(400, 'invalid_prompt');
  const get = async (url: string, headers: Record<string, string>) => {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) }).catch(
      () => null,
    );
    if (!response) throw new Failure(503, 'ai_busy');
    if (await refusesKey(response)) throw new Failure(400, 'ai_key_invalid');
    if (!response.ok) throw new Failure(502, 'ai_failed');
    return response.json();
  };

  switch (vendor) {
    case 'openai': {
      const data = await get('https://api.openai.com/v1/models', {
        Authorization: `Bearer ${key}`,
      });
      const skip = /audio|realtime|transcribe|tts|image|search|embed|moderation|instruct|codex/;
      return (data?.data ?? [])
        .filter((m: { id: string }) => /^(gpt-|o\d|chatgpt)/.test(m.id) && !skip.test(m.id))
        .sort((a: { created: number }, b: { created: number }) => b.created - a.created)
        .map((m: { id: string }) => ({ id: m.id, label: m.id }));
    }
    case 'anthropic': {
      const data = await get('https://api.anthropic.com/v1/models?limit=100', {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      });
      return (data?.data ?? []).map((m: { id: string; display_name?: string }) => ({
        id: m.id,
        label: m.display_name ?? m.id,
      }));
    }
    case 'gemini': {
      const data = await get(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        { 'x-goog-api-key': key },
      );
      return (data?.models ?? [])
        .filter(
          (m: { name: string; supportedGenerationMethods?: string[] }) =>
            m.name.includes('gemini') &&
            (m.supportedGenerationMethods ?? []).includes('generateContent'),
        )
        .map((m: { name: string; displayName?: string }) => ({
          id: m.name.replace(/^models\//, ''),
          label: m.displayName ?? m.name,
        }));
    }
    case 'groq': {
      const data = await get('https://api.groq.com/openai/v1/models', {
        Authorization: `Bearer ${key}`,
      });
      const skip = /whisper|tts|guard|playai|orpheus|distil|compound/i;
      return (data?.data ?? [])
        .filter((m: { id: string; active?: boolean }) => m.active !== false && !skip.test(m.id))
        .sort((a: { created: number }, b: { created: number }) => b.created - a.created)
        .map((m: { id: string }) => ({ id: m.id, label: m.id }));
    }
    case 'mistral': {
      const data = await get('https://api.mistral.ai/v1/models', {
        Authorization: `Bearer ${key}`,
      });
      // Each model is listed under its dated name and its aliases; the "-latest" ones are enough.
      const chat = (data?.data ?? []).filter(
        (m: { id: string; capabilities?: { completion_chat?: boolean }; deprecation?: string }) =>
          m.capabilities?.completion_chat === true &&
          !m.deprecation &&
          !/embed|ocr|moderation|codestral/i.test(m.id),
      );
      const latest = chat.filter((m: { id: string }) => m.id.endsWith('-latest'));
      return (latest.length > 0 ? latest : chat).map((m: { id: string; name?: string }) => ({
        id: m.id,
        label: m.id,
      }));
    }
    case 'openrouter': {
      // The model list is public; asking about the key proves it works.
      await get('https://openrouter.ai/api/v1/key', { Authorization: `Bearer ${key}` });
      const data = await get('https://openrouter.ai/api/v1/models', {});
      return (data?.data ?? [])
        .filter((m: { supported_parameters?: string[] }) =>
          (m.supported_parameters ?? []).includes('response_format'),
        )
        .map((m: { id: string; name?: string }) => ({ id: m.id, label: m.name ?? m.id }));
    }
  }
}
