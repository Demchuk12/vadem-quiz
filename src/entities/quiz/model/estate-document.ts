import type { Locale } from '@shared/i18n';
import { ESTATE_BOARDS, ESTATE_LAYOUT, ESTATE_LIMITS } from '../config/estate-board';
import type {
  EstateCard,
  EstateDeck,
  EstateDocument,
  EstateEffect,
  EstateEffectKind,
  EstateEnd,
} from './estate-document.types';
import type { QuizProgress } from './quiz-document.types';

/** A new quiz is a ready board, the map of Ukraine in the host's language. */
export function emptyEstateQuiz(title: string, locale: Locale = 'uk'): EstateDocument {
  const board = ESTATE_BOARDS[locale];
  return {
    title,
    mode: 'estate',
    regions: [...board.regions],
    cells: [...board.cells],
    fate: board.fate.map((card) => ({ ...card, effect: { ...card.effect } })),
    community: board.community.map((card) => ({ ...card, effect: { ...card.effect } })),
    startMoney: ESTATE_LIMITS.startMoney.default,
    endKind: 'laps',
    endValue: ESTATE_LIMITS.end.laps.default,
    turnSeconds: ESTATE_LIMITS.turnSeconds.default,
  };
}

const filled = (text: string): boolean => text.trim() !== '';

/** Every name and every card text counts; a game needs them all. */
export function estateProgress(doc: EstateDocument): QuizProgress {
  const texts = [
    ...doc.regions,
    ...doc.cells,
    ...[...doc.fate, ...doc.community].map((c) => c.text),
  ];
  return { complete: texts.filter(filled).length, total: texts.length, missingTitles: 0 };
}

export function renameRegion(doc: EstateDocument, region: number, name: string): EstateDocument {
  return { ...doc, regions: doc.regions.map((n, i) => (i === region ? name : n)) };
}

export function renameCell(doc: EstateDocument, cell: number, name: string): EstateDocument {
  return { ...doc, cells: doc.cells.map((n, i) => (i === cell ? name : n)) };
}

export function updateCard(
  doc: EstateDocument,
  deck: EstateDeck,
  index: number,
  card: EstateCard,
): EstateDocument {
  return { ...doc, [deck]: doc[deck].map((c, i) => (i === index ? card : c)) };
}

export function addCard(doc: EstateDocument, deck: EstateDeck): EstateDocument {
  if (doc[deck].length >= ESTATE_LIMITS.cards.max) return doc;
  return { ...doc, [deck]: [...doc[deck], { text: '', effect: { kind: 'money', amount: 0 } }] };
}

export function removeCard(doc: EstateDocument, deck: EstateDeck, index: number): EstateDocument {
  if (doc[deck].length <= ESTATE_LIMITS.cards.min) return doc;
  return { ...doc, [deck]: doc[deck].filter((_, i) => i !== index) };
}

/** A new end keeps its value in range: switching kinds starts from that kind's default. */
export function setEnd(doc: EstateDocument, endKind: EstateEnd, endValue?: number): EstateDocument {
  const range = ESTATE_LIMITS.end[endKind];
  const value = endKind === doc.endKind && endValue !== undefined ? endValue : range.default;
  return { ...doc, endKind, endValue: Math.min(range.max, Math.max(range.min, Math.round(value))) };
}

/** The cells a card may send a player to: none of the card cells, so no card leads to another. */
export const MOVE_TARGETS: readonly number[] = ESTATE_LAYOUT.flatMap((cell, i) =>
  cell.kind === 'fate' || cell.kind === 'community' ? [] : [i],
);

/** A card of another kind, with that kind's usual values. */
export function effectOfKind(kind: EstateEffectKind): EstateEffect {
  switch (kind) {
    case 'money':
      return { kind, amount: 500 };
    case 'each':
      return { kind, amount: 100 };
    case 'repairs':
      return { kind, house: 250, manor: 1000 };
    case 'move':
      return { kind, to: 0 };
    case 'back':
      return { kind, steps: 3 };
    case 'cnap':
      return { kind };
  }
}
