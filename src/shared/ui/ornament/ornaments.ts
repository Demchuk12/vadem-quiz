/**
 * A region's look on the "Господар" board: its colour and its embroidery motif, drawn on a 14 px tile
 * in thread colour. The motifs differ in shape, so regions stay apart without colour too.
 */
export interface OrnamentLook {
  color: string;
  /** Stroked lines of the motif. */
  path: string;
  /** A filled part, when the motif has one. */
  fill?: string;
  stroke: number;
}

export const THREAD = '#fbf3e4';

export const ORNAMENTS: readonly OrnamentLook[] = [
  // Ромб.
  { color: '#4d5e2f', path: 'M7 2.5L11.5 7 7 11.5 2.5 7z', stroke: 1.4 },
  // Ялинка.
  { color: '#a8743a', path: 'M1 10L7 4l6 6', stroke: 1.5 },
  // Хрестик.
  { color: '#1f7a83', path: 'M3.5 3.5l7 7M10.5 3.5l-7 7', stroke: 1.5 },
  // Зірка.
  { color: '#6a3d7a', path: 'M7 1.5v11M1.5 7h11M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6', stroke: 1.1 },
  // Баранячі ріжки.
  { color: '#b0302b', path: 'M2 11c0-5 5-5 5 0c0-5 5-5 5 0', stroke: 1.4 },
  // Віконце.
  {
    color: '#c98a1c',
    path: 'M3.5 3.5h7v7h-7z',
    fill: 'M7 5.6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z',
    stroke: 1.3,
  },
  // Хвиля.
  { color: '#2b5aa8', path: 'M0 8c2.3-3.5 4.7-3.5 7 0s4.7 3.5 7 0', stroke: 1.5 },
  // Ромб із хрестом.
  { color: '#6e0f24', path: 'M7 1.5L12.5 7 7 12.5 1.5 7z M7 4.5v5M4.5 7h5', stroke: 1.2 },
];
