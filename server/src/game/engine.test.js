import { describe, it, expect, beforeEach } from 'vitest';
import { buildDeck } from './deck.js';
import { meldShape, canastaBonus } from './meld.js';
import { initialMeldThreshold, computeRoundScore } from './scoring.js';
import { createMatch, teamOf } from './state.js';
import { applyAction } from './engine.js';
import { redactStateFor } from '../rooms/redact.js';

let idCounter = 0;
function card(rank, suit) {
  return { id: `t${idCounter++}`, rank, suit };
}

describe('deck', () => {
  it('builds the right number of cards per pack count', () => {
    expect(buildDeck(1)).toHaveLength(54);
    expect(buildDeck(2)).toHaveLength(108);
    expect(buildDeck(4)).toHaveLength(216);
  });
});

describe('meldShape', () => {
  it('accepts 3 naturals of the same rank', () => {
    const shape = meldShape([card('7', 'S'), card('7', 'H'), card('7', 'D')]);
    expect(shape.valid).toBe(true);
    expect(shape.rank).toBe('7');
  });

  it('accepts wilds as long as they are fewer than naturals', () => {
    const shape = meldShape([card('7', 'S'), card('7', 'H'), card('2', 'D')]);
    expect(shape.valid).toBe(true);
    expect(shape.isNatural).toBe(false);
  });

  it('rejects wilds >= naturals', () => {
    const shape = meldShape([card('7', 'S'), card('2', 'D'), card('JOKER', null)]);
    expect(shape.valid).toBe(false);
  });

  it('rejects mismatched ranks', () => {
    const shape = meldShape([card('7', 'S'), card('7', 'H'), card('8', 'D')]);
    expect(shape.valid).toBe(false);
  });

  it('rejects fewer than 3 cards', () => {
    expect(meldShape([card('7', 'S'), card('7', 'H')]).valid).toBe(false);
  });

  it('rejects a pure-wild group', () => {
    const shape = meldShape([card('2', 'S'), card('2', 'H'), card('JOKER', null)]);
    expect(shape.valid).toBe(false);
  });
});

describe('canastaBonus', () => {
  it('is 500 for a natural canasta, 300 for a mixed one, 0 below 7 cards', () => {
    const natural = meldShape([card('7', 'S'), card('7', 'H'), card('7', 'D'), card('7', 'C'), card('7', 'S'), card('7', 'H'), card('7', 'D')]);
    const mixed = meldShape([card('7', 'S'), card('7', 'H'), card('7', 'D'), card('7', 'C'), card('7', 'S'), card('7', 'H'), card('2', 'D')]);
    const small = meldShape([card('7', 'S'), card('7', 'H'), card('7', 'D')]);
    expect(canastaBonus(natural)).toBe(500);
    expect(canastaBonus(mixed)).toBe(300);
    expect(canastaBonus(small)).toBe(0);
  });
});

describe('initialMeldThreshold', () => {
  it('follows the 3-tier scale', () => {
    expect(initialMeldThreshold(-100)).toBe(50);
    expect(initialMeldThreshold(0)).toBe(50);
    expect(initialMeldThreshold(1499)).toBe(50);
    expect(initialMeldThreshold(1500)).toBe(90);
    expect(initialMeldThreshold(2999)).toBe(90);
    expect(initialMeldThreshold(3000)).toBe(120);
  });
});

describe('computeRoundScore', () => {
  it('scores red 3 bonuses at 100 each, 800 for all four', () => {
    const base = { meldShapes: [], concealedGoOut: false, wentOutFirst: false, handCards: [] };
    expect(computeRoundScore({ ...base, redThreeCount: 1 })).toBe(100);
    expect(computeRoundScore({ ...base, redThreeCount: 3 })).toBe(300);
    expect(computeRoundScore({ ...base, redThreeCount: 4 })).toBe(800);
  });

  it('adds concealed and go-out-first bonuses', () => {
    const base = { meldShapes: [], redThreeCount: 0, handCards: [] };
    expect(computeRoundScore({ ...base, concealedGoOut: true, wentOutFirst: false })).toBe(500);
    expect(computeRoundScore({ ...base, concealedGoOut: false, wentOutFirst: true })).toBe(100);
  });

  it('subtracts the value of cards left in hand', () => {
    const base = { meldShapes: [], redThreeCount: 0, concealedGoOut: false, wentOutFirst: false };
    const score = computeRoundScore({ ...base, handCards: [card('K', 'S'), card('4', 'H')] });
    expect(score).toBe(-(10 + 5));
  });
});

describe('engine — 1v1 game flow', () => {
  let state;
  const p1 = 'p1';
  const p2 = 'p2';

  beforeEach(() => {
    state = createMatch({ mode: '1v1', packCount: 2, playerIds: [p1, p2] });
  });

  it('rejects actions out of turn', () => {
    const res = applyAction(state, { type: 'DRAW_STOCK', playerId: p2 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not your turn/i);
  });

  it('rejects melding before drawing, and before opening', () => {
    const drawErr = applyAction(state, { type: 'MELD', playerId: p1, cardIds: [] });
    expect(drawErr.ok).toBe(false);

    state.hands[p1] = [card('9', 'S'), card('9', 'H'), card('9', 'D')];
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const openErr = applyAction(state, {
      type: 'MELD',
      playerId: p1,
      cardIds: state.hands[p1].filter((c) => c.rank === '9').map((c) => c.id),
    });
    expect(openErr.ok).toBe(false);
    expect(openErr.error).toMatch(/opening meld/i);
  });

  it('enforces the opening meld threshold and then allows melding freely', () => {
    // score is 0, so threshold is 50. 3 fours = 15, too low.
    state.hands[p1] = [card('4', 'S'), card('4', 'H'), card('4', 'D'), card('K', 'C')];
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });

    const low = applyAction(state, {
      type: 'OPEN_MELD',
      playerId: p1,
      groups: [state.hands[p1].filter((c) => c.rank === '4').map((c) => c.id)],
    });
    expect(low.ok).toBe(false);

    // 3 aces = 60, enough to open.
    state.hands[p1] = [card('A', 'S'), card('A', 'H'), card('A', 'D'), card('K', 'C')];
    const ok = applyAction(state, {
      type: 'OPEN_MELD',
      playerId: p1,
      groups: [state.hands[p1].filter((c) => c.rank === 'A').map((c) => c.id)],
    });
    expect(ok.ok).toBe(true);
    expect(state.initialMeldMade[teamOf(state, p1)]).toBe(true);
  });

  it('auto-extracts red 3s on draw and replaces them for free', () => {
    state.hands[p1] = [];
    state.redThrees[teamOf(state, p1)] = [];
    state.stock = [card('9', 'H'), card('3', 'D')]; // pop order: 3D first, then 9H
    const res = applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    expect(res.ok).toBe(true);
    expect(state.hands[p1]).toHaveLength(1);
    expect(state.hands[p1][0].rank).toBe('9');
    expect(state.redThrees[teamOf(state, p1)]).toHaveLength(1);
  });

  it('ends the round with no go-out bonus when the stock runs dry', () => {
    state.hands[p1] = [card('K', 'S')];
    state.stock = [];
    const res = applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    expect(res.ok).toBe(true);
    expect(res.roundEnded).toBe(true);
    expect(state.roundOver).toBe(true);
    expect(state.wentOutTeam).toBeNull();
  });

  it('refuses to let a player empty their hand without a completed canasta', () => {
    state.hands[p1] = [];
    state.stock.push(card('Q', 'D'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const res = applyAction(state, { type: 'DISCARD', playerId: p1, cardId: state.hands[p1][0].id });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/canasta/i);
    expect(state.hands[p1]).toHaveLength(1);
  });

  it('lets a player go out by discard once their team has a canasta, awarding the go-out bonus', () => {
    const team = teamOf(state, p1);
    const natural = ['7', '7', '7', '7', '7', '7', '7'].map((r, i) => card(r, ['S', 'H', 'D', 'C', 'S', 'H', 'D'][i]));
    state.melds[team]['7'] = meldShape(natural);
    state.initialMeldMade[team] = true;
    state.hands[p1] = [];
    state.stock.push(card('Q', 'D'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const res = applyAction(state, { type: 'DISCARD', playerId: p1, cardId: state.hands[p1][0].id });
    expect(res.ok).toBe(true);
    expect(res.roundEnded).toBe(true);
    expect(state.wentOutTeam).toBe(team);
    expect(state.lastRoundSummary.roundScores[team]).toBeGreaterThan(0);
  });

  it('awards the concealed-hand bonus for opening and going out in the same turn', () => {
    const team = teamOf(state, p1);
    // opening meld is itself a natural canasta, so the go-out canasta requirement
    // is satisfied without any melds from a prior turn (which is what "concealed" means).
    state.hands[p1] = ['S', 'H', 'D', 'C', 'S', 'H'].map((s) => card('7', s));
    state.stock.push(card('7', 'D'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const res = applyAction(state, {
      type: 'OPEN_MELD',
      playerId: p1,
      groups: [state.hands[p1].map((c) => c.id)],
    });
    expect(res.ok).toBe(true);
    expect(res.roundEnded).toBe(true);
    expect(state.concealedGoOut).toBe(true);
    expect(state.lastRoundSummary.roundScores[team]).toBeGreaterThanOrEqual(500);
  });

  it('blocks only the immediate next player from taking the discard pile after a black 3', () => {
    const team1 = teamOf(state, p1);
    state.initialMeldMade[team1] = true;
    state.hands[p1] = [card('3', 'S'), card('9', 'H')];
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const discardRes = applyAction(state, { type: 'DISCARD', playerId: p1, cardId: state.hands[p1][0].id });
    expect(discardRes.ok).toBe(true);
    expect(state.discardBlockedFor).toBe(p2);

    const team2 = teamOf(state, p2);
    state.initialMeldMade[team2] = true;
    const blocked = applyAction(state, { type: 'TAKE_DISCARD', playerId: p2, cardIds: [] });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/blocked/i);
  });

  it('only allows melding black 3s as the closing play, scored at plain card value with no bonus', () => {
    const team = teamOf(state, p1);
    state.initialMeldMade[team] = true;
    state.hasMeldedThisRound[team] = true;
    state.turnStartMelded[team] = true; // not a concealed-hand go-out
    state.redThrees[team] = [];
    state.melds[team]['7'] = meldShape(['S', 'H', 'D', 'C', 'S', 'H', 'D'].map((s) => card('7', s)));
    state.hands[p1] = [card('3', 'S'), card('3', 'C'), card('3', 'S'), card('9', 'H'), card('9', 'D')];
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });

    const tooEarly = applyAction(state, {
      type: 'MELD',
      playerId: p1,
      cardIds: state.hands[p1].filter((c) => c.rank === '3').map((c) => c.id),
    });
    expect(tooEarly.ok).toBe(false);

    state.hands[p1] = [card('3', 'S'), card('3', 'C'), card('3', 'S')];
    const scoreBeforeClosing = state.scores[team];
    const closing = applyAction(state, {
      type: 'MELD',
      playerId: p1,
      cardIds: state.hands[p1].map((c) => c.id),
    });
    expect(closing.ok).toBe(true);
    expect(closing.roundEnded).toBe(true);
    // 3 black 3s at 5 pts each, the natural 7-canasta (7*5 + 500), +100 go-out bonus, no black-3 bonus.
    const expectedGain = 3 * 5 + (7 * 5 + 500) + 100;
    expect(state.scores[team] - scoreBeforeClosing).toBe(expectedGain);
  });
});

describe('taking the discard pile', () => {
  let state;
  const p1 = 'p1';
  const p2 = 'p2';

  beforeEach(() => {
    state = createMatch({ mode: '1v1', packCount: 2, playerIds: [p1, p2] });
    state.initialMeldMade[teamOf(state, p1)] = true;
  });

  it('refuses when the top card is wild', () => {
    state.discard = [card('2', 'H')];
    state.hands[p1] = [card('9', 'S'), card('9', 'H')];
    const res = applyAction(state, {
      type: 'TAKE_DISCARD',
      playerId: p1,
      cardIds: state.hands[p1].map((c) => c.id),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/wild/i);
  });

  it('refuses when the top card is a three', () => {
    state.discard = [card('3', 'S')];
    state.hands[p1] = [card('3', 'C'), card('3', 'S')];
    const res = applyAction(state, {
      type: 'TAKE_DISCARD',
      playerId: p1,
      cardIds: state.hands[p1].map((c) => c.id),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/three/i);
  });

  it('folds the pile into an existing meld of that rank instead of replacing it', () => {
    const team = teamOf(state, p1);
    const existing = [card('9', 'S'), card('9', 'H'), card('9', 'D')];
    state.melds[team]['9'] = meldShape(existing);
    state.discard = [card('4', 'S'), card('9', 'C')];
    state.hands[p1] = [card('9', 'S'), card('9', 'H'), card('K', 'D')];
    const res = applyAction(state, {
      type: 'TAKE_DISCARD',
      playerId: p1,
      cardIds: state.hands[p1].filter((c) => c.rank === '9').map((c) => c.id),
    });
    expect(res.ok).toBe(true);
    // 3 already down + 2 from hand + the top card, and none of the originals lost.
    expect(state.melds[team]['9'].cards).toHaveLength(6);
    for (const c of existing) {
      expect(state.melds[team]['9'].cards.map((x) => x.id)).toContain(c.id);
    }
    // The buried card comes into hand along with the untouched king.
    expect(state.hands[p1].map((c) => c.rank).sort()).toEqual(['4', 'K']);
  });

  it('lets the top card join an existing meld with a single card from hand', () => {
    const team = teamOf(state, p1);
    state.melds[team]['9'] = meldShape([card('9', 'S'), card('9', 'H'), card('9', 'D')]);
    state.discard = [card('K', 'H'), card('9', 'C')];
    state.hands[p1] = [card('9', 'S'), card('Q', 'D')];
    const res = applyAction(state, {
      type: 'TAKE_DISCARD',
      playerId: p1,
      cardIds: [state.hands[p1][0].id],
    });
    expect(res.ok).toBe(true);
    expect(state.melds[team]['9'].cards).toHaveLength(5);
  });

  it('allows taking the pile to form a new meld, moving the rest of the pile into hand', () => {
    state.discard = [card('4', 'S'), card('K', 'H'), card('9', 'C')];
    state.hands[p1] = [card('9', 'S'), card('9', 'H'), card('Q', 'D')];
    const res = applyAction(state, {
      type: 'TAKE_DISCARD',
      playerId: p1,
      cardIds: state.hands[p1].filter((c) => c.rank === '9').map((c) => c.id),
    });
    expect(res.ok).toBe(true);
    expect(state.melds[teamOf(state, p1)]['9'].cards).toHaveLength(3);
    expect(state.discard).toHaveLength(0);
    // kept the Q, plus absorbed the 4 and K that were under the top card
    expect(state.hands[p1].map((c) => c.rank).sort()).toEqual(['4', 'K', 'Q']);
  });

  it('still lets a player add a drawn card to an existing meld of that rank', () => {
    const team = teamOf(state, p1);
    state.melds[team]['9'] = meldShape([card('9', 'S'), card('9', 'H'), card('9', 'D')]);
    state.hands[p1] = [card('K', 'C')];
    state.stock.push(card('9', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: p1 });
    const drawn = state.hands[p1].find((c) => c.rank === '9');
    const res = applyAction(state, { type: 'MELD', playerId: p1, cardIds: [drawn.id], targetRank: '9' });
    expect(res.ok).toBe(true);
    expect(state.melds[team]['9'].cards).toHaveLength(4);
  });
});

describe('free-for-all modes', () => {
  it('gives every seat its own team in 1v1v1 and 1v1v1v1', () => {
    const three = createMatch({ mode: '1v1v1', packCount: 2, playerIds: ['a', 'b', 'c'] });
    expect(three.teams).toEqual([0, 1, 2]);
    expect(three.teamsByPlayer).toEqual({ a: 0, b: 1, c: 2 });

    const four = createMatch({ mode: '1v1v1v1', packCount: 2, playerIds: ['a', 'b', 'c', 'd'] });
    expect(four.teams).toEqual([0, 1, 2, 3]);
    expect(Object.keys(four.scores)).toHaveLength(4);
  });

  it('still pairs seats across the table in 2v2', () => {
    const state = createMatch({ mode: '2v2', packCount: 2, playerIds: ['a', 'b', 'c', 'd'] });
    expect(state.teamsByPlayer).toEqual({ a: 0, b: 1, c: 0, d: 1 });
  });

  it('cycles the turn through all three seats and blocks the next player with a black 3', () => {
    const state = createMatch({ mode: '1v1v1', packCount: 2, playerIds: ['a', 'b', 'c'] });
    state.hands.a = [card('3', 'S'), card('K', 'H')];
    state.stock.push(card('9', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'a' });
    const res = applyAction(state, {
      type: 'DISCARD',
      playerId: 'a',
      cardId: state.hands.a.find((c) => c.rank === '3').id,
    });
    expect(res.ok).toBe(true);
    expect(state.turnOrder[state.currentTurnIndex]).toBe('b');
    expect(state.discardBlockedFor).toBe('b');
  });
});

describe('animation events', () => {
  let state;

  beforeEach(() => {
    state = createMatch({ mode: '1v1', packCount: 2, playerIds: ['p1', 'p2'] });
  });

  it('reports every red 3 pulled out of the opening deal', () => {
    const dealt = state.events.filter((e) => e.type === 'RED_THREE');
    const totalRedThrees = state.teams.reduce((n, t) => n + state.redThrees[t].length, 0);
    expect(dealt).toHaveLength(totalRedThrees);
    for (const event of dealt) {
      expect(event.source).toBe('deal');
      expect(event.card.rank).toBe('3');
      expect(['H', 'D']).toContain(event.card.suit);
    }
    expect(state.events.every((e, i) => e.seq === i + 1)).toBe(true);
  });

  it('reports a red 3 drawn from the stock before the card that replaces it', () => {
    state.stock = [card('9', 'H'), card('3', 'D')]; // pop order: 3D first, then 9H
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'p1' });
    expect(state.events.map((e) => e.type)).toEqual(['RED_THREE', 'DRAW_STOCK']);
    expect(state.events[0].source).toBe('draw');
    expect(state.events[1].card.rank).toBe('9');
  });

  it('clears the batch on each action so only fresh events are broadcast', () => {
    state.stock.push(card('K', 'C'), card('Q', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'p1' });
    const first = state.events;
    expect(first).toHaveLength(1);
    applyAction(state, { type: 'DISCARD', playerId: 'p1', cardId: state.hands.p1[0].id });
    expect(state.events.map((e) => e.type)).toEqual(['DISCARD']);
    expect(state.events[0].seq).toBeGreaterThan(first[0].seq);
  });

  it('emits a meld event carrying the laid-down cards', () => {
    state.hands.p1 = [card('A', 'S'), card('A', 'H'), card('A', 'D'), card('K', 'C')];
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'p1' });
    applyAction(state, {
      type: 'OPEN_MELD',
      playerId: 'p1',
      groups: [state.hands.p1.filter((c) => c.rank === 'A').map((c) => c.id)],
    });
    const meldEvent = state.events.find((e) => e.type === 'MELD');
    expect(meldEvent.opening).toBe(true);
    expect(meldEvent.rank).toBe('A');
    expect(meldEvent.cards).toHaveLength(3);
  });
});

describe('redaction', () => {
  it('hides a drawn card from everyone but the drawer, and keeps melds public', () => {
    const state = createMatch({ mode: '1v1', packCount: 2, playerIds: ['p1', 'p2'] });
    state.stock.push(card('K', 'C'));
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'p1' });

    const mine = redactStateFor(state, 'p1').events.find((e) => e.type === 'DRAW_STOCK');
    const theirs = redactStateFor(state, 'p2').events.find((e) => e.type === 'DRAW_STOCK');
    expect(mine.card.rank).toBe('K');
    expect(theirs.card).toBeNull();

    expect(redactStateFor(state, 'p2').hands.p1).toEqual({ count: state.hands.p1.length });
  });

  it("hides the card dealt to replace someone else's red 3", () => {
    const state = createMatch({ mode: '1v1', packCount: 2, playerIds: ['p1', 'p2'] });
    state.events = [];
    state.stock = [card('9', 'H'), card('3', 'D')];
    applyAction(state, { type: 'DRAW_STOCK', playerId: 'p1' });
    const theirs = redactStateFor(state, 'p2').events;
    expect(theirs.find((e) => e.type === 'RED_THREE').card.rank).toBe('3');
    expect(theirs.find((e) => e.type === 'DRAW_STOCK').card).toBeNull();
  });
});
