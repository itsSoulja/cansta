import { SUITS, RANKS } from './card.js';

export function buildDeck(packCount) {
  const cards = [];
  let n = 0;
  for (let p = 0; p < packCount; p++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `c${n++}`, rank, suit });
      }
    }
    cards.push({ id: `c${n++}`, rank: 'JOKER', suit: null });
    cards.push({ id: `c${n++}`, rank: 'JOKER', suit: null });
  }
  return cards;
}

export function shuffle(cards, rng = Math.random) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
