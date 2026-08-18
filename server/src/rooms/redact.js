import { currentPlayerId, teamOf, teamHasCanasta } from '../game/state.js';
import { discardPickupBlocker } from '../game/engine.js';

function cardBack(count) {
  return { count };
}

export function redactStateFor(state, viewerId) {
  const hands = {};
  for (const pid of state.playerIds) {
    hands[pid] = pid === viewerId ? state.hands[pid] : cardBack(state.hands[pid].length);
  }

  const viewerTeam = teamOf(state, viewerId);
  const topDiscard = state.discard.length ? state.discard[state.discard.length - 1] : null;
  const pileBlockedReason =
    state.discardBlockedFor === viewerId
      ? 'The discard pile is blocked for you this turn'
      : discardPickupBlocker(state, viewerTeam, topDiscard);

  return {
    canTakeDiscard: pileBlockedReason === null,
    takeDiscardReason: pileBlockedReason,
    yourTeamHasCanasta: teamHasCanasta(state, viewerTeam),
    mode: state.mode,
    packCount: state.packCount,
    playerIds: state.playerIds,
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
