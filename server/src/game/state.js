import { buildDeck, shuffle } from './deck.js';
import { isRedThree, isBlackThree, isWild } from './card.js';

const HAND_SIZE = 14;

function assignTeams(mode, seatOrder) {
  const teamsByPlayer = {};
  if (mode === '1v1') {
    teamsByPlayer[seatOrder[0]] = 0;
    teamsByPlayer[seatOrder[1]] = 1;
  } else {
    seatOrder.forEach((pid, idx) => {
      teamsByPlayer[pid] = idx % 2;
    });
  }
  return teamsByPlayer;
}

function dealRound({ packCount, playerIds, teamsByPlayer, teams, rng }) {
  let deck = shuffle(buildDeck(packCount), rng);
  const hands = {};
  for (const pid of playerIds) hands[pid] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const pid of playerIds) {
      hands[pid].push(deck.pop());
    }
  }

  const redThrees = Object.fromEntries(teams.map((t) => [t, []]));
  for (const pid of playerIds) {
    const hand = hands[pid];
    let i = 0;
    while (i < hand.length) {
      if (isRedThree(hand[i])) {
        redThrees[teamsByPlayer[pid]].push(hand[i]);
        const replacement = deck.pop();
        if (replacement) {
          hand[i] = replacement;
        } else {
          hand.splice(i, 1);
        }
      } else {
        i++;
      }
    }
  }

  let discard = [];
  while (deck.length > 0) {
    const card = deck.pop();
    if (isRedThree(card) || isBlackThree(card) || isWild(card)) {
      deck.push(card);
      deck = shuffle(deck, rng);
      continue;
    }
    discard = [card];
    break;
  }

  return { hands, stock: deck, discard, redThrees };
}

export function createMatch({ mode, packCount, playerIds, rng = Math.random }) {
  const teamsByPlayer = assignTeams(mode, playerIds);
  const teams = [...new Set(Object.values(teamsByPlayer))];

  const state = {
    mode,
    packCount,
    playerIds,
    teamsByPlayer,
    teams,
    turnOrder: playerIds,
    currentTurnIndex: 0,
    phase: 'draw',
    hands: {},
    stock: [],
    discard: [],
    discardBlockedFor: null,
    melds: {},
    redThrees: {},
    initialMeldMade: {},
    hasMeldedThisRound: {},
    turnStartMelded: {},
    scores: Object.fromEntries(teams.map((t) => [t, 0])),
    round: 1,
    roundOver: false,
    matchOver: false,
    winner: null,
    lastRoundSummary: null,
  };

  startRound(state, rng);
  return state;
}

export function startRound(state, rng = Math.random) {
  const dealt = dealRound({
    packCount: state.packCount,
    playerIds: state.playerIds,
    teamsByPlayer: state.teamsByPlayer,
    teams: state.teams,
    rng,
  });
  state.hands = dealt.hands;
  state.stock = dealt.stock;
  state.discard = dealt.discard;
  state.redThrees = dealt.redThrees;
  state.melds = Object.fromEntries(state.teams.map((t) => [t, {}]));
  state.initialMeldMade = Object.fromEntries(state.teams.map((t) => [t, false]));
  state.hasMeldedThisRound = Object.fromEntries(state.teams.map((t) => [t, false]));
  state.turnStartMelded = { ...state.hasMeldedThisRound };
  state.discardBlockedFor = null;
  state.currentTurnIndex = 0;
  state.phase = 'draw';
  state.roundOver = false;
  state.wentOutTeam = null;
  state.concealedGoOut = false;
}

export function currentPlayerId(state) {
  return state.turnOrder[state.currentTurnIndex];
}

export function teamOf(state, playerId) {
  return state.teamsByPlayer[playerId];
}

export function teammatesOf(state, playerId) {
  const team = teamOf(state, playerId);
  return state.playerIds.filter((pid) => pid !== playerId && state.teamsByPlayer[pid] === team);
}

export function nextPlayerId(state) {
  const idx = (state.currentTurnIndex + 1) % state.turnOrder.length;
  return state.turnOrder[idx];
}

export function teamMeldShapes(state, team) {
  return Object.values(state.melds[team]);
}

export function teamHasCanasta(state, team) {
  return teamMeldShapes(state, team).some((shape) => shape.isCanasta);
}
