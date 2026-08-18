export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function isJoker(card) {
  return card.rank === 'JOKER';
}

export function isRed(card) {
  return card.suit === 'H' || card.suit === 'D';
}

export function isWild(card) {
  return card.rank === '2' || isJoker(card);
}

export function isRedThree(card) {
  return card.rank === '3' && isRed(card);
}

export function isBlackThree(card) {
  return card.rank === '3' && !isJoker(card) && (card.suit === 'S' || card.suit === 'C');
}

// Lookup the client uses to total a staged meld. Red/black 3s differ, so they
// get their own keys; pointValue() stays the single source of truth for both.
export const POINT_VALUES = {
  JOKER: 50,
  A: 20, '2': 20,
  K: 10, Q: 10, J: 10, '10': 10, '9': 10, '8': 10,
  '7': 5, '6': 5, '5': 5, '4': 5,
  '3red': 100, '3black': 5,
};

export function pointValue(card) {
  if (isJoker(card)) return 50;
  if (card.rank === 'A' || card.rank === '2') return 20;
  if (['K', 'Q', 'J', '10', '9', '8'].includes(card.rank)) return 10;
  if (['7', '6', '5', '4'].includes(card.rank)) return 5;
  if (card.rank === '3') return isRed(card) ? 100 : 5;
  return 0;
}
