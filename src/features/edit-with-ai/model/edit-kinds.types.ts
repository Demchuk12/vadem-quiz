export type AiEditKind = 'round' | 'category' | 'question';

/** A request hosts make often: what its button says and what the AI is asked. */
export interface Chip {
  label: string;
  text: string;
}

/** How one kind of edit is named, and its ready requests. */
export interface KindTexts {
  title: string;
  done: string;
  placeholder: string;
  chips: Chip[];
}
