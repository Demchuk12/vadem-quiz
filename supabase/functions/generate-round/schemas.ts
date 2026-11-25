// JSON schemas that hold the AIs to the reply shape.

import type { RoundRequest } from './types.ts';

/** Strict schemas need every object closed and every field required. */
export const STRICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'questions'],
        properties: {
          title: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'answer', 'explanation', 'image'],
              properties: {
                text: { type: 'string' },
                answer: { type: 'string' },
                explanation: { type: 'string' },
                image: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

export const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                answer: { type: 'string' },
                explanation: { type: 'string' },
                image: { type: 'string' },
              },
              required: ['text', 'answer'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  },
  required: ['categories'],
};

const TEXT = { type: 'string' };

/** What one item of the other games holds, in the same envelope as a board's round. */
const ITEMS = {
  bluff: {
    text: TEXT,
    answer: TEXT,
    decoys: { type: 'array', items: TEXT },
    explanation: TEXT,
  },
  guess: { text: TEXT, answer: TEXT, unit: TEXT, explanation: TEXT },
};

const listSchema = (properties: Record<string, unknown>, strict: boolean) => {
  // Strict schemas need every object closed; Gemini's do not take the keyword.
  const closed = strict ? { additionalProperties: false } : {};
  return {
    type: 'object',
    ...closed,
    required: ['categories'],
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          ...closed,
          required: ['title', 'questions'],
          properties: {
            title: TEXT,
            questions: {
              type: 'array',
              items: { type: 'object', ...closed, required: Object.keys(properties), properties },
            },
          },
        },
      },
    },
  };
};

export const strictSchema = ({ mode }: RoundRequest) =>
  mode === 'board' ? STRICT_SCHEMA : listSchema(ITEMS[mode], true);

export const geminiSchema = ({ mode }: RoundRequest) =>
  mode === 'board' ? GEMINI_SCHEMA : listSchema(ITEMS[mode], false);

/** The OpenAI-style strict format for a request. */
export const strictFormat = (request: RoundRequest) => ({
  type: 'json_schema',
  json_schema: { name: 'round', strict: true, schema: strictSchema(request) },
});
