import { MESSAGES } from './i18n/messages';

/** A failure reported by an RPC function (its short code) or by the network. */
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown, texts: (typeof MESSAGES)['uk']): string {
  return (error instanceof ApiError && texts.codes[error.code]) || texts.unknown;
}
