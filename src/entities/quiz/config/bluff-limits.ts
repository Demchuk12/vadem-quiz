/** How many facts a "Варіанти" quiz holds: a round each. The database checks the same. */
export const BLUFF_FACTS = { default: 10, min: 5, max: 20 } as const;

/** Lengths the database accepts. */
export const BLUFF_LENGTHS = { text: 300, ending: 80, explanation: 2000 } as const;
