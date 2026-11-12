// Photos of answers, from Wikipedia.

import { IMAGE_HOST, IMAGE_SIZE, SITE_URL, WIKIPEDIA_API } from './config.ts';
import type { GeneratedRound } from './types.ts';

/** Lead photos of the named articles, in one request. A missing one only costs that picture. */
export async function attachImages(
  round: GeneratedRound,
  wanted: boolean,
): Promise<GeneratedRound> {
  const titles = [
    ...new Set(
      round.categories.flatMap((category) =>
        category.questions.map((question) => question.image?.trim() ?? '').filter(Boolean),
      ),
    ),
  ].slice(0, wanted ? 50 : 0);
  const urls = new Map<string, string>();
  if (titles.length > 0) {
    try {
      const query = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: String(IMAGE_SIZE),
        pilicense: 'free',
        redirects: '1',
        titles: titles.join('|'),
      });
      const response = await fetch(`${WIKIPEDIA_API}?${query}`, {
        headers: { 'User-Agent': `VademQuiz/1.0 (${SITE_URL})` },
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      const renamed = new Map<string, string>();
      for (const step of [...(data?.query?.normalized ?? []), ...(data?.query?.redirects ?? [])]) {
        renamed.set(step.from, step.to);
      }
      const pages = new Map<string, string>();
      for (const page of data?.query?.pages ?? []) {
        const source = page?.thumbnail?.source;
        if (typeof source === 'string' && IMAGE_HOST.test(source)) pages.set(page.title, source);
      }
      for (const title of titles) {
        let resolved = title;
        for (let hop = 0; hop < 3 && renamed.has(resolved); hop += 1)
          resolved = renamed.get(resolved)!;
        const url = pages.get(resolved);
        if (url) urls.set(title, url);
      }
    } catch (error) {
      console.error('Wikipedia images failed', String(error));
    }
  }
  return {
    categories: round.categories.map((category) => ({
      title: category.title,
      questions: category.questions.map(({ text, answer, explanation, image, decoys }) => {
        const imageUrl = urls.get(image?.trim() ?? '');
        const written = {
          text,
          answer,
          explanation: explanation?.trim() ?? '',
          ...(decoys ? { decoys } : {}),
        };
        return imageUrl ? { ...written, imageUrl } : written;
      }),
    })),
  };
}
