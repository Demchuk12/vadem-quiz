// JSON schemas that hold the AIs to the reply shape.

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
