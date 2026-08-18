import { isWild, pointValue } from './card.js';

export function meldShape(cards) {
  if (cards.length < 3) return { valid: false, reason: 'A meld needs at least 3 cards' };
  const naturals = cards.filter((c) => !isWild(c));
  const wilds = cards.filter(isWild);
  if (naturals.length === 0) return { valid: false, reason: 'A meld needs at least one natural card' };
  const rank = naturals[0].rank;
  if (!naturals.every((c) => c.rank === rank)) {
    return { valid: false, reason: 'Natural cards in a meld must share a rank' };
  }
  if (wilds.length >= naturals.length) {
    return { valid: false, reason: 'Wild cards must be fewer than natural cards in a meld' };
  }
  return {
    valid: true,
    rank,
    cards,
    naturals,
    wilds,
    isCanasta: cards.length >= 7,
    isNatural: wilds.length === 0,
  };
}

export function meldCardValue(cards) {
  return cards.reduce((sum, c) => sum + pointValue(c), 0);
}

export function canastaBonus(shape) {
  if (!shape.isCanasta) return 0;
  return shape.isNatural ? 500 : 300;
}

export function meldValue(shape) {
  return meldCardValue(shape.cards) + canastaBonus(shape);
}
