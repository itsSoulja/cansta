import { isRedThree, isBlackThree } from './card.js';
import { meldShape, meldValue } from './meld.js';
import { computeRoundScore, initialMeldThreshold } from './scoring.js';
import { currentPlayerId, teamOf, teamMeldShapes, teamHasCanasta, startRound } from './state.js';

function extractCards(hand, cardIds) {
  const remaining = hand.slice();
  const cards = [];
  for (const id of cardIds) {
    const idx = remaining.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    cards.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return { cards, remaining };
}

function validateTurn(state, playerId) {
  if (state.matchOver) return { ok: false, error: 'The match is over' };
  if (state.roundOver) return { ok: false, error: 'The round is over' };
  if (currentPlayerId(state) !== playerId) return { ok: false, error: 'Not your turn' };
  return null;
}

function advanceTurn(state) {
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  state.phase = 'draw';
  const nextTeam = teamOf(state, currentPlayerId(state));
  state.turnStartMelded[nextTeam] = state.hasMeldedThisRound[nextTeam];
}

function finalizeRound(state, { wentOutTeam, concealedGoOut = false }) {
  const roundScores = {};
  for (const team of state.teams) {
    const teamPlayers = state.playerIds.filter((pid) => state.teamsByPlayer[pid] === team);
    const handCards = teamPlayers.flatMap((pid) => state.hands[pid]);
    roundScores[team] = computeRoundScore({
      meldShapes: teamMeldShapes(state, team),
      redThreeCount: state.redThrees[team].length,
      concealedGoOut: team === wentOutTeam && concealedGoOut,
      wentOutFirst: team === wentOutTeam,
      handCards,
    });
    state.scores[team] += roundScores[team];
  }
  const didGoOut = wentOutTeam !== null && wentOutTeam !== undefined;
  state.roundOver = true;
  state.wentOutTeam = didGoOut ? wentOutTeam : null;
  state.concealedGoOut = didGoOut ? concealedGoOut : false;
  state.lastRoundSummary = { roundScores, wentOutTeam: didGoOut ? wentOutTeam : null, concealedGoOut };

  const winner = state.teams.find((t) => state.scores[t] >= 5000);
  if (winner !== undefined) {
    state.matchOver = true;
    state.winner = winner;
  }
}

function drawAndAbsorbRedThrees(state, playerId) {
  const team = teamOf(state, playerId);
  while (true) {
    if (state.stock.length === 0) return false;
    const card = state.stock.pop();
    if (isRedThree(card)) {
      state.redThrees[team].push(card);
      continue;
    }
    state.hands[playerId].push(card);
    return true;
  }
}

function handleDrawStock(state, { playerId }) {
  const err = validateTurn(state, playerId);
  if (err) return err;
  if (state.phase !== 'draw') return { ok: false, error: 'You have already drawn this turn' };
  if (state.stock.length === 0) {
    finalizeRound(state, { wentOutTeam: null });
    return { ok: true, roundEnded: true };
  }
  const drew = drawAndAbsorbRedThrees(state, playerId);
  if (!drew) {
    finalizeRound(state, { wentOutTeam: null });
    return { ok: true, roundEnded: true };
  }
  state.phase = 'action';
  return { ok: true };
}

// Simplification: taking the discard pile is only available once a side has
// already opened, to avoid modeling multi-meld staging against the opening
// threshold for a pile pickup.
function handleTakeDiscard(state, { playerId, cardIds = [], targetRank }) {
  const err = validateTurn(state, playerId);
  if (err) return err;
  if (state.phase !== 'draw') return { ok: false, error: 'You have already drawn this turn' };
  if (state.discardBlockedFor === playerId) return { ok: false, error: 'The discard pile is blocked for you this turn' };
  if (state.discard.length === 0) return { ok: false, error: 'The discard pile is empty' };

  const team = teamOf(state, playerId);
  if (!state.initialMeldMade[team]) {
    return { ok: false, error: "Your side must open with a meld before taking the discard pile" };
  }

  const topCard = state.discard[state.discard.length - 1];
  const extracted = extractCards(state.hands[playerId], cardIds);
  if (!extracted) return { ok: false, error: 'Invalid cards selected' };
  const meldCards = [...extracted.cards, topCard];

  let shape;
  if (targetRank) {
    const existing = state.melds[team][targetRank];
    if (!existing) return { ok: false, error: 'No existing meld of that rank' };
    shape = meldShape([...existing.cards, ...meldCards]);
  } else {
    shape = meldShape(meldCards);
  }
  if (!shape.valid) return { ok: false, error: shape.reason };
  if (shape.rank === '3') return { ok: false, error: 'Threes cannot be melded this way' };

  const restOfPile = state.discard.slice(0, -1);
  const newHand = [...extracted.remaining, ...restOfPile];

  const wouldEmptyHand = newHand.length === 0;
  if (wouldEmptyHand) {
    const hypotheticalMelds = { ...state.melds[team], [shape.rank]: shape };
    if (!Object.values(hypotheticalMelds).some((s) => s.isCanasta)) {
      return { ok: false, error: 'Cannot go out without a completed canasta' };
    }
  }

  state.hands[playerId] = newHand;
  state.discard = [];
  state.melds[team][shape.rank] = shape;
  state.hasMeldedThisRound[team] = true;
  state.discardBlockedFor = null;
  state.phase = 'action';

  if (wouldEmptyHand) {
    const concealed = !state.turnStartMelded[team];
    finalizeRound(state, { wentOutTeam: team, concealedGoOut: concealed });
    return { ok: true, roundEnded: true };
  }
  return { ok: true };
}

function handleOpenMeld(state, { playerId, groups = [] }) {
  const err = validateTurn(state, playerId);
  if (err) return err;
  if (state.phase !== 'action') return { ok: false, error: 'Draw a card before melding' };
  const team = teamOf(state, playerId);
  if (state.initialMeldMade[team]) return { ok: false, error: 'Your side has already opened; use meld instead' };
  if (groups.length === 0) return { ok: false, error: 'No cards selected' };

  let remaining = state.hands[playerId].slice();
  const shapes = [];
  const usedRanks = new Set();
  for (const cardIds of groups) {
    const extracted = extractCards(remaining, cardIds);
    if (!extracted) return { ok: false, error: 'Invalid cards selected' };
    const shape = meldShape(extracted.cards);
    if (!shape.valid) return { ok: false, error: shape.reason };
    if (shape.rank === '3') return { ok: false, error: 'Black 3s cannot be part of an opening meld' };
    if (usedRanks.has(shape.rank)) return { ok: false, error: 'Duplicate rank across opening meld groups' };
    usedRanks.add(shape.rank);
    shapes.push(shape);
    remaining = extracted.remaining;
  }

  const totalValue = shapes.reduce((sum, s) => sum + meldValue(s), 0);
  const threshold = initialMeldThreshold(state.scores[team]);
  if (totalValue < threshold) {
    return { ok: false, error: `Opening meld must be worth at least ${threshold} points (this is worth ${totalValue})` };
  }

  const wouldEmptyHand = remaining.length === 0;
  if (wouldEmptyHand && !shapes.some((s) => s.isCanasta)) {
    return { ok: false, error: 'Cannot go out without a completed canasta' };
  }

  state.hands[playerId] = remaining;
  for (const shape of shapes) state.melds[team][shape.rank] = shape;
  state.initialMeldMade[team] = true;
  state.hasMeldedThisRound[team] = true;

  if (wouldEmptyHand) {
    const concealed = !state.turnStartMelded[team];
    finalizeRound(state, { wentOutTeam: team, concealedGoOut: concealed });
    return { ok: true, roundEnded: true };
  }
  return { ok: true };
}

function handleMeld(state, { playerId, cardIds = [], targetRank }) {
  const err = validateTurn(state, playerId);
  if (err) return err;
  if (state.phase !== 'action') return { ok: false, error: 'Draw a card before melding' };
  const team = teamOf(state, playerId);
  if (!state.initialMeldMade[team]) return { ok: false, error: 'Make your opening meld first' };

  const extracted = extractCards(state.hands[playerId], cardIds);
  if (!extracted) return { ok: false, error: 'Invalid cards selected' };

  let shape;
  if (targetRank) {
    const existing = state.melds[team][targetRank];
    if (!existing) return { ok: false, error: 'No existing meld of that rank' };
    shape = meldShape([...existing.cards, ...extracted.cards]);
  } else {
    shape = meldShape(extracted.cards);
  }
  if (!shape.valid) return { ok: false, error: shape.reason };

  if (shape.rank === '3' && extracted.remaining.length > 1) {
    return { ok: false, error: 'Black 3s can only be melded when going out' };
  }

  const wouldEmptyHand = extracted.remaining.length === 0;
  if (wouldEmptyHand) {
    const hypotheticalMelds = { ...state.melds[team], [shape.rank]: shape };
    if (!Object.values(hypotheticalMelds).some((s) => s.isCanasta)) {
      return { ok: false, error: 'Cannot go out without a completed canasta' };
    }
  }

  state.hands[playerId] = extracted.remaining;
  state.melds[team][shape.rank] = shape;
  state.hasMeldedThisRound[team] = true;

  if (wouldEmptyHand) {
    const concealed = !state.turnStartMelded[team];
    finalizeRound(state, { wentOutTeam: team, concealedGoOut: concealed });
    return { ok: true, roundEnded: true };
  }
  return { ok: true };
}

function handleDiscard(state, { playerId, cardId }) {
  const err = validateTurn(state, playerId);
  if (err) return err;
  if (state.phase !== 'action') return { ok: false, error: 'Draw a card before discarding' };
  const hand = state.hands[playerId];
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, error: 'Card not in hand' };
  const card = hand[idx];
  const team = teamOf(state, playerId);

  const wouldEmptyHand = hand.length === 1;
  if (wouldEmptyHand && !teamHasCanasta(state, team)) {
    return { ok: false, error: 'Cannot go out without a completed canasta' };
  }

  const newHand = hand.slice();
  newHand.splice(idx, 1);
  state.hands[playerId] = newHand;
  state.discard.push(card);

  if (wouldEmptyHand) {
    const concealed = !state.turnStartMelded[team];
    finalizeRound(state, { wentOutTeam: team, concealedGoOut: concealed });
    return { ok: true, roundEnded: true };
  }

  const upcomingPlayer = state.turnOrder[(state.currentTurnIndex + 1) % state.turnOrder.length];
  state.discardBlockedFor = isBlackThree(card) ? upcomingPlayer : null;
  advanceTurn(state);
  return { ok: true };
}

export function applyAction(state, action) {
  switch (action.type) {
    case 'DRAW_STOCK':
      return handleDrawStock(state, action);
    case 'TAKE_DISCARD':
      return handleTakeDiscard(state, action);
    case 'OPEN_MELD':
      return handleOpenMeld(state, action);
    case 'MELD':
      return handleMeld(state, action);
    case 'DISCARD':
      return handleDiscard(state, action);
    default:
      return { ok: false, error: `Unknown action type: ${action.type}` };
  }
}

export function startNextRound(state, rng = Math.random) {
  if (state.matchOver) return { ok: false, error: 'The match is already over' };
  if (!state.roundOver) return { ok: false, error: 'The current round is not over yet' };
  state.round += 1;
  startRound(state, rng);
  return { ok: true };
}
