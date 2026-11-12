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

/** "Варіанти": the same envelope, each fact with its false endings. */
const BLUFF_FACT = {
  text: { type: 'string' },
  answer: { type: 'string' },
  decoys: { type: 'array', items: { type: 'string' } },
  explanation: { type: 'string' },
};

export const BLUFF_STRICT_SCHEMA = {
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
              required: ['text', 'answer', 'decoys', 'explanation'],
              properties: BLUFF_FACT,
            },
          },
        },
      },
    },
  },
};

export const BLUFF_GEMINI_SCHEMA = {
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
              properties: BLUFF_FACT,
              required: ['text', 'answer', 'decoys'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  },
  required: ['categories'],
};

export const strictSchema = (request: RoundRequest) =>
  request.mode === 'bluff' ? BLUFF_STRICT_SCHEMA : STRICT_SCHEMA;

export const geminiSchema = (request: RoundRequest) =>
  request.mode === 'bluff' ? BLUFF_GEMINI_SCHEMA : GEMINI_SCHEMA;

/** The OpenAI-style strict format for a request. */
export const strictFormat = (request: RoundRequest) => ({
  type: 'json_schema',
  json_schema: { name: 'round', strict: true, schema: strictSchema(request) },
});
