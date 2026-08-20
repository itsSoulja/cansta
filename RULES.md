# Cansta rules

How the game actually plays, as the engine enforces it. Every rule here lives in
`server/src/game/` — the client never decides anything, it renders a redacted
snapshot and sends action intents.

This document is a description of the code, not a second source of truth. Each
section says which file owns the rule so the two can be checked against each
other. Where Cansta departs from standard Canasta, it is called out under
[House rules](#house-rules) — those are deliberate choices, not bugs.

---

## 1. The shape of a game

| Mode | Seats | Teams |
| --- | --- | --- |
| `1v1` | 2 | one seat each |
| `1v1v1` | 3 | one seat each |
| `1v1v1v1` | 4 | one seat each |
| `2v2` | 4 | seats paired by `idx % 2`, so partners sit opposite |

Only `2v2` pairs anyone up. Every other mode gives each seat its own team, which
means the scoring, opening threshold and go-out rules below apply per player
without changing a word.

**Packs.** Each pack is 52 cards plus 2 jokers. Heads-up is fixed at 2 packs;
every larger table lets the host pick 2, 3 or 4.

**Match end.** The first side to reach **5000** points wins. The check runs after
each round is scored.

*Seat counts: `SEATS_BY_MODE` in `rooms/roomManager.js`. Teams: `assignTeams` in
`game/state.js`. Match target: `finalizeRound` in `game/engine.js`.*

---

## 2. The deal

- **14 cards** to each player, however many packs are in play.
- **Who deals** is drawn at random when the match is created — hosting a room
  buys no head start. Each round after that, the deal passes to the player on
  the previous dealer's **left**, read off the seating that round was played in.
- **Everyone changes seats between rounds.** A free-for-all is shuffled outright;
  in `2v2` the two pairs are shuffled separately and interleaved, so partners
  stay opposite. Because the seating moves as well, the deal takes a random walk
  around the table rather than a fixed cycle — it just never lands twice running.
- **Red 3s dealt into a hand** are moved to that side's red-3 pile straight away
  and replaced from the stock. The replacement is dealt face down, so only its
  owner sees it. If the stock has run dry, the card is simply removed.
- **The upcard** is the first card turned that is not a red 3, a black 3, or a
  wild. Anything else goes back and the stock is reshuffled.

*`dealRound`, `rotateSeating` and `startRound` in `game/state.js`.*

---

## 3. A turn

A turn has two phases, in order.

### Draw phase

Do exactly one of:

- **Draw from the stock.** Any red 3 that comes up goes straight to your side's
  pile and you keep drawing until a card you can actually hold arrives.
- **Take the discard pile** — see [The discard pile](#5-the-discard-pile).

If the stock is empty when your draw begins, or runs out while red 3s are being
absorbed, **the round ends immediately** and nobody goes out.

### Action phase

Meld as much as you like, or nothing at all, and then **discard**. Discarding is
what ends your turn and passes play on — there is no other way to end it.

*`handleDrawStock`, `handleDiscard` in `game/engine.js`.*

---

## 4. Melds

A meld is a set of cards of one rank, laid face up in front of your side.

- **At least 3 cards.**
- **At least one natural**, and every natural in the meld shares a rank.
- **Wilds strictly fewer than naturals.** Three naturals hold at most two wilds.
- **At most 3 wilds**, however long the meld grows. A 12-card meld still tops out
  at three.
- **One meld per rank per side.** Adding cards to a rank you already meld
  re-validates the whole thing, so a meld that would break either wild rule is
  refused rather than trimmed.

Wilds are **2s and jokers**.

**Canasta.** A meld of **7 or more** cards. Worth **500** if it is all naturals,
**300** if it leans on any wild. A side needs at least one completed canasta
before anyone on it may go out.

*`meldShape`, `canastaBonus` in `game/meld.js`.*

---

## 5. Opening

Your side's **first lay-down of the round** has to clear a threshold, and the
threshold rises with your cumulative score:

| Your side's score so far | Opening must be worth |
| --- | --- |
| below 0 | **15** |
| 0 – 1499 | **50** |
| 1500 – 2999 | **90** |
| 3000 and up | **120** |

A side in the red opens on 15 — the standard concession that lets a team that has
been hammered get back onto the table.

Everything you lay down on that turn counts toward the total together — that is
why the opening flow stages several groups before sending them. **Black 3s can
never be part of an opening meld.**

Until your side has opened, it may not meld at all and may not take the pile.

*`initialMeldThreshold` in `game/scoring.js`; `handleOpenMeld` in `game/engine.js`.*

---

## 6. The discard pile

Taking the pile replaces your draw. It is refused, with the reason shown to you
on the pile itself, if **any** of these hold:

- it is not your turn, or the round or match is over;
- you have already drawn this turn;
- the previous player discarded a black 3, blocking you for this turn;
- you hold **2 cards or fewer** — you need more than 2, because taking the pile
  costs you cards before the buried ones arrive;
- the pile is empty;
- the top card is a **wild**;
- the top card is **any 3**;
- your side **already melds the top card's rank**.

When you do take it:

- you must select cards from your hand that **meld with the top card** — the top
  card always starts a fresh meld and never joins an existing one;
- **until your side has melded, that means a natural pair**: two cards of the top
  card's rank out of your own hand. One natural and a wild is refused. Once the
  side has something on the table, one and a wild is enough;
- **only the top card is melded**; the whole rest of the pile goes to your hand;
- black 3s cannot be melded off the pile;
- **taking the pile may be your side's opening play.** Only what you actually lay
  down counts toward the threshold — the top card included, the buried cards not,
  since those merely land in your hand.

The client highlights the pile and shows the blocking sentence by calling the
engine's own check, so it can never drift from what the engine will accept.

*`discardTakeBlocker`, `discardPickupBlocker`, `handleTakeDiscard` in
`game/engine.js`; surfaced by `rooms/redact.js`.*

---

## 7. Threes

**Red 3s** are never held. They go to your side's pile on sight — on the deal
(replaced from stock) or on a draw (you simply draw again). Each is worth
**100**, and all four together **800**. That value is a **bonus if your side
opened, and the same figure against you if it never did.**

**Black 3s** are ordinary cards with two quirks:

- Discarding one **blocks the next player only**, for that one turn. There is no
  full freeze.
- They can only be melded **as you go out** — that is, when melding them leaves
  you one card or none. They can never open, and never come off the pile.

*`isRedThree`/`isBlackThree` in `game/card.js`; `redThreeValue` in
`game/scoring.js`; the black-3 block in `handleDiscard`, the meld restriction in
`handleMeld`.*

---

## 8. Going out

**You must end a turn holding at least 2 cards** — unless that turn is the one
that ends the round.

To go out, your side needs a **completed canasta**. With one, you may:

- lay down to **1 card** and discard it, going out as the turn ends; or
- lay down to **0 cards** with no discard at all.

Without a canasta you simply cannot drop below 2. The floor exists to stop a
player stranding themselves on a single card they can neither discard nor meld,
with the turn unable to end.

**Going out first** is worth **+100**.

**Concealed go-out** is worth a further **+500**: it applies when your side had
not melded anything *before this turn began*. Laying everything down and going
out in one turn earns it; melding last turn and finishing this turn does not.

The round also ends, with nobody going out and no +100, when **the stock runs
out**.

*`goingOutBlocked` and the `turnStartMelded` snapshot in `game/engine.js`.*

---

## 9. Scoring

At the end of a round each side scores:

```
  meld card values
+ canasta bonuses          500 natural, 300 mixed
+ red 3s                   100 each, 800 for all four — negative if never opened
+ 500                      concealed go-out
+ 100                      went out first
- cards left in hand       every player on the side
```

Card values:

| Card | Points |
| --- | --- |
| Joker | 50 |
| Ace, 2 | 20 |
| K Q J 10 9 8 | 10 |
| 7 6 5 4 | 5 |
| Red 3 | 100 |
| Black 3 | 5 |

Cards left in hand count against the side **for every player on it**, not just
whoever was caught holding them.

*`computeRoundScore` in `game/scoring.js`; `pointValue` in `game/card.js`.*

---

## 10. Seats, and getting back to one

A seat belongs to a **player id**, not to a connection. The browser tab mints
that id once and keeps it for as long as the tab is open, so a reload arrives
claiming the seat it just left.

- **Before the game is dealt**, dropping out gives the seat up: it goes back in
  the pool for the next arrival, and the host passes on if it was theirs.
- **Once cards are out**, the seat is held. It keeps its hand, its melds and its
  place in the turn order, and the table shows it as *away*. Nobody may play for
  an absent player, so the turn simply waits on them.
- **Coming back**: a reload does it by itself. Failing that — a closed tab, a
  different device — the table code is on screen all game; typing it on the
  landing page sits you down in the empty chair, hand and all. Whoever takes it
  over inherits the id the cards were dealt to.
- A started table with **every seat still held** turns newcomers away.
- Rooms only exist in the server's memory. One with **nobody connected for 30
  minutes** is swept, and a server restart drops every game in progress.

*`rooms/roomManager.js` (`joinRoom`, `detachSocket`, `sweepAbandonedRooms`);
`server/src/index.js` for the socket half; `client/src/session.js` and
`hooks/useGame.js` for the tab's side of it.*

---

## House rules

Cansta is not tournament Canasta. These are deliberate simplifications —
check before "fixing" one.

1. **You cannot take the pile onto a rank you already meld.** Standard Canasta's
   commonest pickup is adding the top card to an existing meld; here it is
   refused. The upshot is that the top card always *starts* a meld, so a pickup
   never has to fold into a stored shape.
2. **Only the top card is melded on pickup.** The rest of the pile goes to hand
   regardless of what is in it.
3. **Black 3s block one player, not the pile.** There is no freeze mechanic —
   no freezing with a wild, no frozen-pile pickup rules.
4. **Taking the pile can be an opening play**, with only the laid-down cards
   counting toward the threshold.
5. **Canasta bonuses count toward the opening threshold.** An opening lay-down
   that is itself a canasta clears 50 on the bonus alone. Standard Canasta counts
   card points only.
6. **No partner permission.** In `2v2` you may go out without asking your
   partner.
7. **Hand size is 14 regardless of pack count**, and there is no separate
   requirement tying canastas to the number of packs.
8. **The pile costs a natural pair before you have opened.** Standard Canasta
   lets a wild help you into an unfrozen pile whatever you have down; here the
   first pickup of the round has to be paid for with two real cards of that rank.
9. **A seat is held, not given away.** Losing the connection mid-hand keeps the
   seat and its cards; a reload walks back into it, and anyone with the table
   code can take over a chair that has been left empty (§10). Rooms are still in
   memory only — a server restart drops every game in progress, and a table with
   nobody at it is swept after 30 minutes.

---

## Where the rules live

| File | Owns |
| --- | --- |
| `game/card.js` | Card categories and **point values** |
| `game/deck.js` | Deck composition and the shuffle |
| `game/meld.js` | **Meld validity**, canasta detection and bonuses |
| `game/scoring.js` | **Round scoring** and the opening-threshold ladder |
| `game/state.js` | Dealing, seating, turn order, who holds the deal |
| `game/engine.js` | **The turn rules** — every action, the pile checks, going out, round end |
| `game/engine.test.js` | The executable statement of most of the above |
| `rooms/roomManager.js` | Seat counts per mode, pack-count policy, **who holds a seat** across a lost connection |
| `rooms/rooms.test.js` | The executable statement of the seat rules |
| `rooms/redact.js` | Per-viewer redaction, and the pile hints it derives *from the engine* |

When adding a rule it belongs in `server/src/game/`, never in `Table.jsx`. If the
UI needs a hint derived from a rule, compute it in `redact.js` from a shared
engine helper rather than reimplementing it in React.
