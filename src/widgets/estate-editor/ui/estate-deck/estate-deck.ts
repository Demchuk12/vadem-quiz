import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ESTATE_EFFECT_KINDS,
  ESTATE_LIMITS,
  MOVE_TARGETS,
  addCard,
  effectOfKind,
  removeCard,
  updateCard,
  type EstateCard,
  type EstateDeck,
  type EstateDocument,
  type EstateEffect,
  type EstateEffectKind,
} from '@entities/quiz';
import { injectMessages, injectNumberFormat } from '@shared/i18n';
import { VdButton } from '@vadem/ui/button';
import { VD_CARD } from '@vadem/ui/card';
import { VdField } from '@vadem/ui/field';
import { VdIcon } from '@vadem/ui/icon';
import { VdInput } from '@vadem/ui/input';
import { VdOption, VdSelect } from '@vadem/ui/select';
import { MESSAGES } from '../../i18n/messages';

/** A number a card holds besides its kind. */
type EffectNumber = 'amount' | 'house' | 'manor' | 'to' | 'steps';

/** One deck of a "Господар" quiz: each card's text and what it does. */
@Component({
  selector: 'vq-estate-deck',
  imports: [NgTemplateOutlet, VdButton, VD_CARD, VdField, VdIcon, VdInput, VdOption, VdSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './estate-deck.scss',
  templateUrl: './estate-deck.html',
})
export class EstateDeckEditor {
  protected readonly t = injectMessages(MESSAGES);
  readonly deck = input.required<EstateDeck>();
  readonly quiz = input.required<EstateDocument>();
  readonly quizChange = output<EstateDocument>();

  protected readonly format = injectNumberFormat();
  protected readonly limits = ESTATE_LIMITS;
  protected readonly kinds = ESTATE_EFFECT_KINDS;
  protected readonly targets = MOVE_TARGETS;
  protected readonly cards = computed(() => this.quiz()[this.deck()]);

  protected numberOf(effect: EstateEffect, key: EffectNumber): number {
    return (effect as unknown as Record<EffectNumber, number>)[key];
  }

  /** The range a number of the card may take. */
  protected rangeOf(effect: EstateEffect, key: EffectNumber): { min: number; max: number } {
    const { effects } = ESTATE_LIMITS;
    if (key === 'amount') return effect.kind === 'each' ? effects.each : effects.money;
    if (key === 'to') return { min: 0, max: 31 };
    return effects[key];
  }

  protected setText(index: number, card: EstateCard, event: Event): void {
    this.emit(index, { ...card, text: (event.target as HTMLTextAreaElement).value });
  }

  protected setKind(index: number, card: EstateCard, kind: EstateEffectKind): void {
    if (kind === card.effect.kind) return;
    this.emit(index, { ...card, effect: effectOfKind(kind) });
  }

  protected setNumber(index: number, card: EstateCard, key: EffectNumber, raw: unknown): void {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) return;
    const { min, max } = this.rangeOf(card.effect, key);
    const effect = { ...card.effect, [key]: Math.min(max, Math.max(min, value)) } as EstateEffect;
    this.emit(index, { ...card, effect });
  }

  protected add(): void {
    this.quizChange.emit(addCard(this.quiz(), this.deck()));
  }

  protected remove(index: number): void {
    this.quizChange.emit(removeCard(this.quiz(), this.deck(), index));
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private emit(index: number, card: EstateCard): void {
    this.quizChange.emit(updateCard(this.quiz(), this.deck(), index, card));
  }
}
