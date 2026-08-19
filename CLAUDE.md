# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cansta — a real-time multiplayer Canasta game. npm workspaces: `server` (Express + socket.io, authoritative game engine) and `client` (React 19 + Vite). No TypeScript, no build step on the server.

`RULES.md` at the repo root describes how the game plays, section by section, with the file that owns each rule. It is a description of the engine rather than a second source of truth — if the two disagree, the engine is right and the doc needs correcting.

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

- Client → server: `create_room`, `join_room`, `leave_room`, `start_game`, `action`, `next_round`, each with an ack callback returning `{ ok, error? }`.
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
- `initialMeldMade[team]` gates melding and pile pickup, sets the sign of the red 3 bonus at scoring time, and its threshold scales with cumulative score (50/90/120).
- A meld must be built on naturals: wilds strictly fewer than naturals, and at most three wilds however long the meld grows (`MAX_WILDS` in `game/meld.js`).
- A turn ends with a card still in hand unless it is the turn that ends the round (`goingOutBlocked` in `game/engine.js`). A lay-down may leave one card — the discard then takes it as you go out — or none at all, but only when the side has a canasta. Without one, stopping at a single card would strand a player who can neither discard nor meld, with the turn unable to end. Taking the pile is separate: it needs more than 2 cards in hand, since it costs you cards before the buried ones arrive.
- `turnOrder` is the seating and `playerIds` the roster: the roster fixes team membership for the match, while the seating is reshuffled every round by `rotateSeating` (2v2 interleaves the two shuffled pairs so partners stay opposite). The client renders the ring from `turnOrder`, so both are in the redacted payload.
- `startingPlayerId` holds the deal. It is drawn at random when the match is created — the host has no head start — and each round passes to the player on the previous dealer's left, read off the seating that round was played in, before the reshuffle. Since the seating moves too, the deal takes a random walk rather than a fixed cycle; it just never lands twice running.
- Match ends at 5000 points.

### Modes

Four modes: `1v1`, `1v1v1`, `1v1v1v1`, `2v2`. Only 2v2 pairs seats (`idx % 2`); every other mode gives each seat its own team, so the per-team scoring, opening threshold, and go-out rules carry over untouched. Seat counts live in `SEATS_BY_MODE` in `roomManager.js` — the one place to change when adding a mode. Heads-up is fixed at 2 packs; every larger table lets the host pick 2–4.

### Animation events

`state.events` carries what just happened, so the client can move cards between piles instead of snapping to the new snapshot: `RED_THREE` (with `source: 'deal' | 'draw'`), `DRAW_STOCK`, `TAKE_DISCARD`, `MELD`, `DISCARD`, `ROUND_END`. `applyAction` clears the array on entry, so each broadcast carries only that action's batch; `pushEvent` in `state.js` stamps a monotonic `seq` the client uses to skip events it already played.

These are **decorative only** — state remains a full snapshot and correctness never depends on an event being received. But they are redacted alongside it (`redactEvent` in `redact.js`): a `DRAW_STOCK` card and a red three's `replacement` are face down to everyone but that player. Any new event carrying a hidden card must be added there.

### Redaction is also the client's rule oracle

`rooms/redact.js` builds the per-viewer payload: other players' hands collapse to `{ count }`, and it precomputes `canTakeDiscard` / `takeDiscardReason` by calling `discardTakeBlocker` — the *same* function the engine uses to validate. That's why `discardTakeBlocker` is exported from `engine.js`. Keep it that way: the client highlights the pile and shows the blocking reason without owning a copy of the rules. It covers the turn and phase gates too (`discardPickupBlocker` under it holds only the rules about the card itself), so a pile the viewer cannot take always carries a sentence saying why.

If you add a derived hint for the UI, compute it in `redact.js` from a shared engine helper rather than reimplementing it in React.

### Deliberate rule simplifications

These are choices, not bugs — check with the user before "fixing" them:

- Taking the discard pile is refused when your side already melds the top card's rank — a house rule, not standard Canasta, where adding the top card to an existing meld is the commonest pickup. It means the top card always *starts* a meld and never joins one, so `TAKE_DISCARD` never has to fold into a stored shape.
- Taking the pile may be a side's opening play. Only what is laid down counts toward the threshold — the top card included, the buried cards not. `TAKE_DISCARD` therefore accepts `groups` like `OPEN_MELD` does, with a flat `cardIds` list as the single-meld shorthand.
- Only the top discard card is melded on pickup; the rest goes to hand.
- Black 3s only block the next player's pickup (`discardBlockedFor`); there is no full freeze mechanic.

### Easter eggs

Drop an image into `easter eggs/` at the repo root, named for the player name that should summon it (`Elon Musk.jpeg`). Typing a name close enough to that file — spacing, case and punctuation ignored, and a slip or two of the finger forgiven by `server/src/eggs/match.js` — paints the picture behind the whole app for that player.

The pictures are deliberately **not** part of the client bundle. A build-time glob would put every secret name and every image URL into the JS in plaintext, one devtools panel away. Instead the server holds them: `GET /easter-egg?name=…` answers with a sha256-derived token only when a name matches, and `GET /easter-egg/:token` serves that file. There is no endpoint that lists them, the token is a Map key rather than a path, and a name that matches nothing is indistinguishable from a name that does not exist.

Render serves those images, so the folder has to be committed — the client half of the deploy never sees them.

### Client

`useGame.js` is the single socket boundary — one hook holding `connected/myId/lobby/game/error` plus the emit wrappers. `App.jsx` routes on state alone: `game` → `Table`, else `lobby` → `Lobby`, else `Landing`.

`Table.jsx` holds all interaction state (`selected`, `stagedGroups`, `targetRank`). The opening meld needs multiple groups at once to clear the threshold, hence the stage-a-group flow; ordinary melds send a flat `cardIds` + optional `targetRank`.

Styling is class-based in `client/src/index.css` (felt table, fanned hand, card faces). `MeldArea.jsx` and `ScorePanel.jsx` still use inline styles and haven't been migrated.

## Deployment

Split deploy, both halves named `cansta`:

| Half | Host | URL |
| --- | --- | --- |
| Server (API + sockets) | Render, auto-deploys on push to `main` | https://cansta.onrender.com |
| Client | Cloudflare Pages | https://cansta.pages.dev |

The client is **not** deployed by pushing — it must be built and uploaded:

```bash
VITE_SERVER_URL=https://cansta.onrender.com npm run build --workspace client
npx wrangler pages deploy client/dist --project-name=cansta --branch=main
```

That env var is load-bearing: without it the built bundle falls back to the
page's own origin (`client/src/socket.js`), so a Pages-hosted client would try
to open sockets against Cloudflare and never reach the game.

`server/src/index.js` also serves `client/dist` when that directory exists,
which is what makes a single-host setup possible; in this split deploy it never
exists on Render, so that branch stays dormant.

Render's free plan sleeps after ~15 minutes idle (~50s cold start), and rooms
live in memory, so any redeploy or sleep destroys games in progress.
