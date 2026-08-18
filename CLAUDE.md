# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cansta — a real-time multiplayer Canasta game. npm workspaces: `server` (Express + socket.io, authoritative game engine) and `client` (React 19 + Vite). No TypeScript, no build step on the server.

## Commands

```bash
npm run dev:server          # node --watch, listens on :3001
npm run dev:client          # vite dev server on :5173
npm run test:server         # vitest run (server/src/game/engine.test.js)
npm start                   # production server

npm run test:server -- -t "opening meld"   # run tests matching a name
npm run build --workspace client           # vite build -> client/dist
npm run lint --workspace client            # oxlint
```

There are no client tests.

## Architecture

### The server owns the game

The client never computes rules. It renders a redacted state snapshot and emits action intents; every rule lives in `server/src/game/`. When adding a rule, it goes in the engine — not in `Table.jsx`.

The socket protocol is deliberately tiny (`server/src/index.js`):

- Client → server: `create_room`, `join_room`, `start_game`, `action`, `next_round`, each with an ack callback returning `{ ok, error? }`.
- Server → client: `lobby` (room roster, broadcast to the room) and `state` (per-socket, **individually redacted**, sent in a loop over seats — never `io.to(room).emit('state')`, that would leak hands).

Every mutation funnels through `applyAction(state, action)` in `game/engine.js`, a switch over `DRAW_STOCK | TAKE_DISCARD | OPEN_MELD | MELD | DISCARD`. The handlers are pure-ish: they mutate `state` in place and return `{ ok, error? , roundEnded? }`. `index.js` re-broadcasts only when `ok`.

### Player identity is `socket.id`

Seats, `state.playerIds`, `teamsByPlayer`, `hands`, and turn order are all keyed by socket id. **There is no reconnect path** — a refresh or dropped connection frees the seat (`leaveRoom`) and orphans that player's hand while the match keeps referencing the dead id. Any work on resilience starts by introducing a stable player id separate from the socket id.

Rooms live in module-level `Map`s in `rooms/roomManager.js` — in-memory only, so a server restart drops all games.

### State shape (`game/state.js`)

One `state` object per room holds the whole match across rounds. Load-bearing details:

- `melds[team]` is keyed **by rank**, so a side has at most one meld per rank. Adding cards replaces the stored shape with a re-validated one.
- Meld "shapes" (`game/meld.js`) are computed objects (`{ valid, rank, cards, naturals, wilds, isCanasta, isNatural }`) stored directly in state, not recomputed on read.
- `hasMeldedThisRound` vs `turnStartMelded`: the latter is snapshotted in `advanceTurn` so the concealed go-out bonus can tell "melded before this turn" from "melded during it".
- `initialMeldMade[team]` gates both melding and pile pickup; the threshold scales with cumulative score (50/90/120).
- Match ends at 5000 points.

### Redaction is also the client's rule oracle

`rooms/redact.js` builds the per-viewer payload: other players' hands collapse to `{ count }`, and it precomputes `canTakeDiscard` / `takeDiscardReason` by calling `discardPickupBlocker` — the *same* function the engine uses to validate. That's why `discardPickupBlocker` is exported from `engine.js`. Keep it that way: the client highlights the pile and shows the blocking reason without owning a copy of the rules.

If you add a derived hint for the UI, compute it in `redact.js` from a shared engine helper rather than reimplementing it in React.

### Deliberate rule simplifications

These are choices, not bugs — check with the user before "fixing" them:

- Taking the discard pile requires your side to have already opened, and is refused if your side already melds the top card's rank. This avoids modeling a pile pickup against the opening threshold.
- Only the top discard card is melded on pickup; the rest goes to hand.
- Black 3s only block the next player's pickup (`discardBlockedFor`); there is no full freeze mechanic.

### Client

`useGame.js` is the single socket boundary — one hook holding `connected/myId/lobby/game/error` plus the emit wrappers. `App.jsx` routes on state alone: `game` → `Table`, else `lobby` → `Lobby`, else `Landing`.

`Table.jsx` holds all interaction state (`selected`, `stagedGroups`, `targetRank`). The opening meld needs multiple groups at once to clear the threshold, hence the stage-a-group flow; ordinary melds send a flat `cardIds` + optional `targetRank`.

Styling is class-based in `client/src/index.css` (felt table, fanned hand, card faces). `MeldArea.jsx` and `ScorePanel.jsx` still use inline styles and haven't been migrated.

## Deployment

Split deploy: server on Render (`render.yaml`), client built separately (a `.wrangler/` dir suggests Cloudflare Pages). `server/src/index.js` serves `client/dist` **only if that directory exists**, which supports the single-host/tunnel setup; in the split deploy the client needs `VITE_SERVER_URL` pointing at the server origin (`client/src/socket.js`).
