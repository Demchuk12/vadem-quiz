import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Media } from '@shared/api';
import { AiSettings } from './ai-settings';
import { AiWriter } from './ai-writer';
import type { OwnAi } from './ai-writer.types';
import { QuizApi } from './quiz-api';
import type { GenerateRoundRequest } from './quiz-api.types';
import { QuizWriter } from './quiz-writer';

/** Settings kept in memory: the writer must not care where they live. */
class MemorySettings implements AiSettings {
  readonly choice = signal('auto');
  readonly ownAis = signal<OwnAi[]>([]);
  saveChoice(provider: string): void {
    this.choice.set(provider);
  }
  saveOwn(ais: OwnAi[]): void {
    this.ownAis.set(ais);
  }
}

const mistral = {
  vendor: 'mistral' as const,
  key: 'key-mistral',
  model: 'mistral-large-latest',
  modelLabel: 'Large',
};

function setUp() {
  const sent: GenerateRoundRequest[] = [];
  const settings = new MemorySettings();
  TestBed.configureTestingModule({
    providers: [
      { provide: AiSettings, useValue: settings },
      { provide: QuizWriter, useClass: AiWriter },
      {
        provide: QuizApi,
        useValue: {
          aiProviders: () => Promise.resolve([{ id: 'gemini', label: 'Gemini' }]),
          generateRound: (request: GenerateRoundRequest) => {
            sent.push(request);
            return Promise.resolve({
              provider: request.provider === 'own' ? 'own:0' : 'gemini',
              categories: [{ title: 'Кіно', questions: [{ text: 'Q', answer: 'A' }] }],
            });
          },
        },
      },
      { provide: Media, useValue: { uploadFrom: () => Promise.resolve('q/x.webp') } },
    ],
  });
  return { writer: TestBed.inject(QuizWriter), settings, sent };
}

const request = {
  quizId: 'quiz',
  token: 'token',
  prompt: 'Кіно',
  round: 1,
  roundCount: 1,
  categories: 1,
  questions: 1,
  avoid: [],
  avoidAnswers: [],
  images: false,
  explain: false,
};

describe('AiWriter', () => {
  it('keeps an added AI and its choice in the settings it is given', () => {
    const { writer, settings } = setUp();
    writer.addOwn(mistral);
    expect(settings.ownAis()).toHaveLength(1);
    expect(settings.choice()).toBe(`own:${settings.ownAis()[0]!.id}`);
    expect(writer.labelOf(writer.provider())).toBe('Mistral · Large');
  });

  it('sends only the chosen own AI and names it as the writer', async () => {
    const { writer, sent } = setUp();
    writer.addOwn(mistral);
    const result = await writer.write(request);
    expect(sent[0]!.provider).toBe('own');
    expect(sent[0]!.own).toEqual([
      { vendor: 'mistral', key: 'key-mistral', model: 'mistral-large-latest' },
    ]);
    expect(result.writer).toBe('Mistral · Large');
  });

  it('sends no own keys to a chosen free AI', async () => {
    const { writer, sent } = setUp();
    writer.addOwn(mistral);
    writer.choose('gemini');
    await writer.write(request);
    expect(sent[0]).toMatchObject({ provider: 'gemini', own: [] });
  });

  it('falls back to "auto" when the chosen own AI is removed', () => {
    const { writer, settings } = setUp();
    writer.addOwn(mistral);
    writer.removeOwn(settings.ownAis()[0]!.id);
    expect(settings.choice()).toBe('auto');
  });
});
