import { buildDeck, shuffle } from './deck.js';
import { isRedThree, isBlackThree, isWild } from './card.js';

const HAND_SIZE = 14;

// In a free-for-all each seat is its own team, so the scoring, opening-threshold
// and go-out rules all apply per player unchanged. Team mode splits the seats
// alternately into two sides, however many are at the table, which is what puts
// partners opposite each other.
function assignTeams(mode, seatOrder) {
  const teamsByPlayer = {};
  seatOrder.forEach((pid, idx) => {
    teamsByPlayer[pid] = mode === 'teams' ? idx % 2 : idx;
  });
  return teamsByPlayer;
}

// Appends an animation event. The client replays these to move cards between
// piles instead of snapping to the new snapshot; seq lets it ignore events it
// has already played. Purely decorative — state is always a full snapshot.
export function pushEvent(state, event) {
  state.eventSeq += 1;
  state.events.push({ seq: state.eventSeq, ...event });
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
  const redThreeEvents = [];
  for (const pid of playerIds) {
    const hand = hands[pid];
    let i = 0;
    while (i < hand.length) {
      if (isRedThree(hand[i])) {
        const three = hand[i];
        redThrees[teamsByPlayer[pid]].push(three);
        const replacement = deck.pop();
        if (replacement) {
          hand[i] = replacement;
        } else {
          hand.splice(i, 1);
        }
        // The replacement is dealt face down, so only its owner may see it.
        redThreeEvents.push({
          type: 'RED_THREE',
          source: 'deal',
          playerId: pid,
          team: teamsByPlayer[pid],
          card: three,
          replacement: replacement ?? null,
        });
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

  return { hands, stock: deck, discard, redThrees, redThreeEvents };
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
    turnOrder: [...playerIds],
    // Who deals first is drawn out of a hat, so hosting a room is no longer
    // worth a free head start; from there it walks one seat left each round.
    startingPlayerId: playerIds[Math.floor(rng() * playerIds.length)],
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
    events: [],
    eventSeq: 0,
  };

  startRound(state, rng);
  return state;
}

// Two seatings are the same table if one is a rotation of the other: every
// player still has the same neighbours, and the client draws the ring from each
// viewer's own seat, so nobody would see a thing change.
function sameTable(a, b) {
  const start = a.indexOf(b[0]);
  return b.every((pid, i) => a[(start + i) % a.length] === pid);
}

// Everyone moves seats between rounds. A free-for-all can be shuffled outright;
// in team mode the two sides are shuffled separately and then interleaved, so
// partners keep sitting opposite each other and `assignTeams` still holds.
function reseat(state, rng) {
  if (state.mode !== 'teams') return shuffle(state.turnOrder, rng);
  const pairs = state.teams.map((team) =>
    shuffle(state.turnOrder.filter((pid) => state.teamsByPlayer[pid] === team), rng),
  );
  return pairs[0].flatMap((pid, i) => [pid, pairs[1][i]]);
}

// Between rounds the deal passes to the left — read off the seating the round
// was played in, before that seating is thrown away — and then everyone shuffles
// round the table. Small tables run out of arrangements (heads-up has only the
// one), so an unchanged seating is accepted rather than chased forever.
export function rotateSeating(state, rng = Math.random) {
  const seated = state.turnOrder;
  const idx = seated.indexOf(state.startingPlayerId);
  state.startingPlayerId = seated[(idx + 1) % seated.length];

  let next = reseat(state, rng);
  for (let tries = 0; tries < 8 && sameTable(next, seated); tries++) next = reseat(state, rng);
  state.turnOrder = next;
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
  state.currentTurnIndex = Math.max(0, state.turnOrder.indexOf(state.startingPlayerId));
  state.phase = 'draw';
  state.roundOver = false;
  state.wentOutTeam = null;
  state.concealedGoOut = false;
  state.events = [];
  for (const event of dealt.redThreeEvents) pushEvent(state, event);
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
