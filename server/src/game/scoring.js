import { meldValue } from './meld.js';
import { pointValue } from './card.js';

export function initialMeldThreshold(cumulativeScore) {
  if (cumulativeScore >= 3000) return 120;
  if (cumulativeScore >= 1500) return 90;
  return 50;
}

export function handValue(hand) {
  return hand.reduce((sum, c) => sum + pointValue(c), 0);
}

export function computeRoundScore({ meldShapes, redThreeCount, concealedGoOut, wentOutFirst, handCards }) {
  let score = meldShapes.reduce((sum, shape) => sum + meldValue(shape), 0);
  score += redThreeCount === 4 ? 800 : redThreeCount * 100;
  if (concealedGoOut) score += 500;
  if (wentOutFirst) score += 100;
  score -= handValue(handCards);
  return score;
}
