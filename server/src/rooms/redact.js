import { currentPlayerId, teamOf, teamHasCanasta } from '../game/state.js';
import { discardTakeBlocker } from '../game/engine.js';
import { initialMeldThreshold } from '../game/scoring.js';
import { POINT_VALUES } from '../game/card.js';

function cardBack(count) {
  return { count };
}

// Events drive animations, so they must respect the same secrecy as the state:
// a card drawn from the stock is face down to everyone but the drawer, as is
// the card dealt to replace a red three. Melds, discards and the red threes
// themselves are laid face up and stay public.
function redactEvent(event, viewerId) {
  if (event.playerId === viewerId) return event;
  if (event.type === 'DRAW_STOCK') return { ...event, card: null };
  if (event.type === 'RED_THREE' && event.replacement) return { ...event, replacement: null };
  return event;
}

export function redactStateFor(state, viewerId) {
  const hands = {};
  for (const pid of state.playerIds) {
    hands[pid] = pid === viewerId ? state.hands[pid] : cardBack(state.hands[pid].length);
  }

  const viewerTeam = teamOf(state, viewerId);
  const topDiscard = state.discard.length ? state.discard[state.discard.length - 1] : null;
  const pileBlockedReason = discardTakeBlocker(state, viewerId);

  return {
    openingThreshold: initialMeldThreshold(state.scores[viewerTeam]),
    pointValues: POINT_VALUES,
    events: (state.events ?? []).map((e) => redactEvent(e, viewerId)),
    canTakeDiscard: pileBlockedReason === null,
    takeDiscardReason: pileBlockedReason,
    yourTeamHasCanasta: teamHasCanasta(state, viewerTeam),
    mode: state.mode,
    packCount: state.packCount,
    playerIds: state.playerIds,
    turnOrder: state.turnOrder,
    teamsByPlayer: state.teamsByPlayer,
    teams: state.teams,
    round: state.round,
    currentPlayerId: currentPlayerId(state),
    yourTeam: viewerTeam,
    phase: state.phase,
    hands,
    yourHand: state.hands[viewerId] ?? [],
    stockCount: state.stock.length,
    topDiscard,
    discardCount: state.discard.length,
    discardBlockedFor: state.discardBlockedFor,
    melds: state.melds,
    redThrees: state.redThrees,
    initialMeldMade: state.initialMeldMade,
    scores: state.scores,
    roundOver: state.roundOver,
    matchOver: state.matchOver,
    winner: state.winner,
    wentOutTeam: state.wentOutTeam,
    concealedGoOut: state.concealedGoOut,
    lastRoundSummary: state.lastRoundSummary,
  };
}
