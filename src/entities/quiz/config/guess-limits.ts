/** How many questions a "На око" quiz holds: a round each. The database checks the same. */
export const GUESS_QUESTIONS = { default: 10, min: 5, max: 20 } as const;

/** The clock of a new quiz, in seconds; it may be switched off. */
export const GUESS_SECONDS = 30;

/** What the database accepts. */
export const GUESS_LENGTHS = { text: 300, unit: 20, explanation: 2000 } as const;
