/** The eight tokens of "Господар", by turn order. Each is a stroked 24 px drawing on its colour. */
export interface EstateTokenLook {
  key: 'varenyk' | 'hlechyk' | 'sonyashnyk' | 'kit' | 'trembita' | 'motanka' | 'bandura' | 'pivnyk';
  color: string;
  path: string;
}

export const ESTATE_TOKENS: readonly EstateTokenLook[] = [
  {
    key: 'varenyk',
    color: '#e9b949',
    path: 'M3 15A9 9 0 0 1 21 15Z M5.6 9.6L4.3 8.5 M9 7.1L8.4 5.5 M15 7.1L15.6 5.5 M18.4 9.6L19.7 8.5',
  },
  {
    key: 'kit',
    color: '#6db8ec',
    path: 'M4.5 20V5.5L8.5 9.5h7l4-4V20z M9 14v.5 M15 14v.5 M10.5 17h3',
  },
  {
    key: 'trembita',
    color: '#ec8bb4',
    path: 'M3.5 20.5L15 9 M5 22L16.5 10.5 M15 9l1-5.5 M16.5 10.5l5.5-1 M16 3.5l6 6 M7 16l2 2 M10.5 12.5l2 2',
  },
  {
    key: 'motanka',
    color: '#6fd3a6',
    path: 'M14.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M12 3.5v5 M9.5 6h5 M5.5 11.5h13 M9.5 9.5L5.5 21h13l-4-11.5',
  },
  {
    key: 'hlechyk',
    color: '#f0955a',
    path: 'M9 3.5h6 M10 3.5V7C6.5 8.5 5 11.5 5 14.5 5 18 8 20.5 12 20.5s7-2.5 7-6c0-3-1.5-6-5-7.5V3.5 M17.3 9.5c2.4.3 3 3 1.3 5 M6.5 13.5h11',
  },
  {
    key: 'bandura',
    color: '#b9a3f0',
    path: 'M12 2.5c-1 0-1.8.8-1.8 1.8V9C7.3 10 5 12.8 5 16.3 5 19.8 8 21.5 12 21.5s7-1.7 7-5.2c0-3.5-2.3-6.3-5.2-7.3V4.3c0-1-.8-1.8-1.8-1.8z M10 13.5l.8 6 M12 12.5v7.5 M14 13.5l-.8 6',
  },
  {
    key: 'sonyashnyk',
    color: '#d7d86a',
    path: 'M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z M12 2.5v4 M12 17.5v4 M2.5 12h4 M17.5 12h4 M5.3 5.3l2.8 2.8 M15.9 15.9l2.8 2.8 M5.3 18.7l2.8-2.8 M15.9 8.1l2.8-2.8',
  },
  {
    key: 'pivnyk',
    color: '#7fd6dd',
    path: 'M6 20.5h11 M8 20.5C5.5 19 4 16 4.5 12.5l3 2C8.5 10 10.5 6.5 14 6.5c2 0 3.5 1.5 3.5 3.5l2.5 1-2.5 1.2c-.2 3.5-1.8 6.6-4.5 8.3 M13 6.5l.8-2.8 1.4 2 1.3-1.7 M4.5 12.5L2.5 8 M6 13.5L5 8.5 M15 10v.5',
  },
];

/** Line drawings of the cells nobody owns and of the buildings, on a 24 px grid. */
export const ESTATE_ICONS = {
  start: 'M20 12H5 M10 7l-5 5 5 5',
  cnap: 'M4 7h16v3.5a2 2 0 0 0 0 4V18H4v-3.5a2 2 0 0 0 0-4z M14 7v11',
  rest: 'M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-2-1-4 0-7z M4 21l16-3 M4 18l16 3',
  summons: 'M3 6h18v12H3z M3 6l9 7 9-7',
  station:
    'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z M5 11h14 M8 21l2-3 M16 21l-2-3 M9 14.5v.5 M15 14.5v.5',
  utility: 'M13 2L5 14h6l-1 8 8-12h-6z',
  fate: 'M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.4 6.7 19.3l1.1-5.9L3.4 9.3l6-.8z',
  community:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6 M16 11a2.5 2.5 0 1 0 0-5 M21 20c0-3-1.5-5-4-5.7',
  tax: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3',
} as const;

/** A house (16 × 16) and a manor (24 × 16), filled with the owner's colour. */
export const ESTATE_HOUSE = 'M8 1.8L1.5 7.4V14.5h13V7.4z';
export const ESTATE_MANOR = 'M1 7.5L6 3l6 4 6-4 5 4.5v7H1z';
