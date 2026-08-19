import { meldValue } from './meld.js';
import { pointValue } from './card.js';

// A side in the red opens on 15 — the standard concession that lets a team
// that has been hammered get back on the table.
export function initialMeldThreshold(cumulativeScore) {
  if (cumulativeScore < 0) return 15;
  if (cumulativeScore >= 3000) return 120;
  if (cumulativeScore >= 1500) return 90;
  return 50;
}

export function handValue(hand) {
  return hand.reduce((sum, c) => sum + pointValue(c), 0);
}

// Red 3s are a bonus only to a side that got a meld down. Caught with them and
// nothing on the table, the same value counts against you instead.
export function redThreeValue(redThreeCount, opened) {
  const value = redThreeCount === 4 ? 800 : redThreeCount * 100;
  return opened ? value : -value;
}

export function computeRoundScore({ meldShapes, redThreeCount, opened, concealedGoOut, wentOutFirst, handCards }) {
  let score = meldShapes.reduce((sum, shape) => sum + meldValue(shape), 0);
  score += redThreeValue(redThreeCount, opened);
  if (concealedGoOut) score += 500;
  if (wentOutFirst) score += 100;
  score -= handValue(handCards);
  return score;
}
