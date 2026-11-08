// Failures: a final one with its status, and one another attempt may not repeat.

export class Failure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** A failure that another attempt, or another provider, may not repeat. */
export class Retryable extends Error {
  constructor(
    readonly code: string,
    /** The model is out of its limit: asking it again soon is pointless. */
    readonly exhausted = false,
  ) {
    super(code);
  }
}
