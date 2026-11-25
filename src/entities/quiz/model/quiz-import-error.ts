export type ImportProblem =
  | 'not_json'
  | 'round_count'
  | 'text'
  | 'positive_int'
  | 'seconds'
  | 'list'
  | 'object'
  | 'board_file'
  | 'bluff_file';

/** Where in the file: numbers count from 1, as the host sees them. Empty for the whole quiz. */
export interface ImportPlace {
  field?: string;
  round?: number;
  category?: number;
  question?: number;
  fact?: number;
}

/** Why an imported file does not fit. The texts are in i18n. */
export class QuizImportError extends Error {
  constructor(
    readonly problem: ImportProblem,
    /** Absent when the problem is with the file as a whole. */
    readonly place?: ImportPlace,
  ) {
    super(problem);
    this.name = 'QuizImportError';
  }
}
