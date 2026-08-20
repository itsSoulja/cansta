import { useMemo, useState } from 'react';
import { CardGuideHold } from '../components/CardGuide.jsx';
import { CenterPiles } from '../components/CenterPiles.jsx';
import { HandFan } from '../components/HandFan.jsx';
import { MeldArea, RedThreeZone } from '../components/MeldArea.jsx';
import { RoomCode } from '../components/RoomCode.jsx';
import { ScorePanel } from '../components/ScorePanel.jsx';
import { Seat } from '../components/Seat.jsx';
import { StagingTray, buildGroups } from '../components/StagingTray.jsx';
import { FlightLayer } from '../anim/FlightLayer.jsx';
import { useCardFlights } from '../anim/useCardFlights.js';

// Where each opponent sits, by how many of them there are. You are always at
// the bottom, so the others spread evenly across the rest of the table.
const SEAT_POSITIONS = {
  1: ['top'],
  2: ['upper-left', 'upper-right'],
  3: ['left', 'top', 'right'],
};

export function Table({ game, lobby, myId, sendAction, nextRound, error }) {
  const [selected, setSelected] = useState([]);
  const [wildAssignments, setWildAssignments] = useState({});

  const seatFor = (playerId) => lobby?.seats.find((s) => s && s.playerId === playerId) ?? null;
  const nameFor = (playerId) => seatFor(playerId)?.name ?? 'Player';
  // A seat whose player has closed the tab or lost the network keeps its hand
  // and waits. Nobody else can act for them, so the table has to say so.
  const isAway = (playerId) => seatFor(playerId)?.connected === false;
  const awayNames = (lobby?.seats ?? [])
    .filter((s) => s && !s.connected && game.playerIds.includes(s.playerId))
    .map((s) => s.name);
  const hostAway = lobby ? isAway(lobby.hostPlayerId) : false;

  const { flights, hiddenIds, legMs } = useCardFlights({ events: game.events, myId });

  const isYourTurn = game.currentPlayerId === myId;
  const opened = game.initialMeldMade[game.yourTeam];
  const inDraw = isYourTurn && game.phase === 'draw';
  const inAction = isYourTurn && game.phase === 'action';
  const canDiscardHere = inAction && selected.length === 1;
  const canTakePile = inDraw && game.canTakeDiscard;
  // A turn ends holding a card unless it is the turn that ends the round, so
  // going under two needs a canasta to go out on. This only warns: the meld
  // being laid down may be the canasta itself, and the server settles it.
  const MIN_HAND = 2;
  const wouldStripHand =
    selected.length > 0 && game.yourHand.length - selected.length < MIN_HAND && !game.yourTeamHasCanasta;

  const selectedCards = useMemo(
    () => selected.map((id) => game.yourHand.find((c) => c.id === id)).filter(Boolean),
    [selected, game.yourHand],
  );
  // While the pile is yours to take, its top card is shown inside the staged
  // group it would join, so the running total is the one the pickup is judged on.
  const pileCard = canTakePile ? game.topDiscard : null;
  const groups = useMemo(
    () => buildGroups(selectedCards, wildAssignments, game.pointValues, pileCard),
    [selectedCards, wildAssignments, game.pointValues, pileCard],
  );
  const stagedTotal = groups.reduce((sum, g) => sum + g.points, 0);
  // Before a side opens, the top card has to be met by a natural pair out of
  // hand. The engine says whether that applies; the tray is only reporting it.
  const pileGroup = groups.find((g) => g.fromPile);
  const needsNaturalPair = Boolean(canTakePile && game.pileNeedsNaturalPair && pileGroup && pileGroup.cards.length < 2);

  // Seat the opponents in turn order starting from the player after you, so the
  // turn visibly travels around the table.
  const opponents = useMemo(() => {
    const order = game.turnOrder;
    const mine = order.indexOf(myId);
    return order.slice(mine + 1).concat(order.slice(0, mine));
  }, [game.turnOrder, myId]);

  // In 2v2 a team shares one meld area: yours sits in front of you, theirs in
  // front of the first opponent on that team.
  const meldSeatByTeam = useMemo(() => {
    const map = {};
    for (const team of game.teams) {
      map[team] = team === game.yourTeam ? myId : game.turnOrder.find((pid) => game.teamsByPlayer[pid] === team);
    }
    return map;
  }, [game.teams, game.yourTeam, game.turnOrder, game.teamsByPlayer, myId]);

  const clearSelection = () => {
    setSelected([]);
    setWildAssignments({});
  };

  const toggleCard = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const cycleWild = (card) => {
    const ranks = groups.filter((g) => g.rank).map((g) => g.rank);
    if (ranks.length < 2) return;
    const current = wildAssignments[card.id] ?? groups.find((g) => g.wilds.some((w) => w.id === card.id))?.rank;
    const next = ranks[(ranks.indexOf(current) + 1) % ranks.length];
    setWildAssignments((prev) => ({ ...prev, [card.id]: next }));
  };

  const drawStock = () => inDraw && sendAction({ type: 'DRAW_STOCK' });

  const onPileClick = () => {
    if (canDiscardHere) return sendAction({ type: 'DISCARD', cardId: selected[0] }, clearSelection);
    if (canTakePile) {
      // Groups, not a flat list: opening off the pile may need several melds to
      // clear the threshold, exactly as OPEN_MELD does.
      sendAction({ type: 'TAKE_DISCARD', groups: groups.map((g) => g.all.map((c) => c.id)) }, (res) => {
        if (res.ok) clearSelection();
      });
    }
  };

  // Lays every staged group down at once when opening; afterwards each group
  // goes down as its own meld, one after the other.
  const layDown = () => {
    if (!groups.length) return;
    if (!opened) {
      return sendAction({ type: 'OPEN_MELD', groups: groups.map((g) => g.all.map((c) => c.id)) }, (res) => {
        if (res.ok) clearSelection();
      });
    }
    const queue = groups.map((g) => g.all.map((c) => c.id));
    const sendNext = (i) => {
      if (i >= queue.length) return clearSelection();
      sendAction({ type: 'MELD', cardIds: queue[i] }, (res) => (res.ok ? sendNext(i + 1) : null));
    };
    sendNext(0);
  };

  const addToMeld = (rank) => {
    if (!isYourTurn || selected.length === 0) return;
    sendAction({ type: 'MELD', cardIds: selected, targetRank: rank }, (res) => {
      if (res.ok) clearSelection();
    });
  };

  if (game.matchOver || game.roundOver) {
    const isHost = lobby?.hostPlayerId === myId;
    const summary = game.lastRoundSummary;
    const won = game.winner === game.yourTeam;
    return (
      <div className="table-stage table-stage--summary">
        <div className="summary-card">
          <h1 className="summary-card__title">
            {game.matchOver ? (won ? 'You win the match' : 'Match over') : `Round ${game.round} complete`}
          </h1>
          {!game.matchOver &&
            (summary?.wentOutTeam != null ? (
              <p className="summary-card__lede">
                {summary.wentOutTeam === game.yourTeam ? 'You went out' : `${nameFor(game.currentPlayerId)}'s side went out`}
                {summary.concealedGoOut ? ' — concealed, +500.' : '.'}
              </p>
            ) : (
              <p className="summary-card__lede">The stock ran dry — nobody went out.</p>
            ))}
          <ScorePanel game={game} nameFor={nameFor} />
          {!game.matchOver &&
            (isHost || hostAway ? (
              <button className="btn btn--primary" onClick={nextRound}>
                Deal the next round
                {!isHost && hostAway ? ' (the host has left)' : ''}
              </button>
            ) : (
              <p className="summary-card__wait">Waiting for the host to deal…</p>
            ))}
          {lobby && <p className="summary-card__code">table code {lobby.code}</p>}
        </div>
      </div>
    );
  }

  const positions = SEAT_POSITIONS[opponents.length] ?? [];

  return (
    <div className="table-stage">
      <div className="table-glow" />
      <div className="table-rays" />

      <header className="table-top">
        <div className="table-top__left">
          <span className="table-top__brand">
            Cansta <span className="table-top__round">Round {game.round}</span>
            <CardGuideHold game={game} />
          </span>
          <RoomCode code={lobby?.code} />
        </div>

        {/* A seat is never given away mid-hand: it holds its cards until its
            player reloads back into it, or somebody types the code and takes
            the chair over. Either way the table waits, so it says who for. */}
        {awayNames.length > 0 && (
          <div className="away-strip">
            <strong>{awayNames.join(' and ')}</strong>
            {awayNames.length > 1 ? ' have' : ' has'} left the table — the hand is being held.
            {lobby && <span className="away-strip__code"> Rejoin with code {lobby.code}</span>}
          </div>
        )}

        <ScorePanel game={game} nameFor={nameFor} />
      </header>

      {opponents.map((pid, i) => {
        const team = game.teamsByPlayer[pid];
        const partner = team === game.yourTeam;
        return (
          <Seat
            key={pid}
            position={positions[i]}
            name={{ playerId: pid, label: nameFor(pid) }}
            count={game.hands[pid]?.count ?? 0}
            active={game.currentPlayerId === pid}
            away={isAway(pid)}
            team={team}
            melds={game.melds}
            redThrees={game.redThrees}
            hiddenIds={hiddenIds}
            showMelds={meldSeatByTeam[team] === pid}
            teamLabel={partner ? 'partner' : null}
          />
        );
      })}

      <CenterPiles
        game={game}
        canDraw={inDraw}
        yourTurn={isYourTurn}
        canTakePile={canTakePile}
        canDiscardHere={canDiscardHere}
        onDrawStock={drawStock}
        onPileClick={onPileClick}
        hiddenIds={hiddenIds}
        selectedCount={selected.length}
      />

      <div className={`you-zone${isYourTurn ? ' you-zone--active' : ''}`}>
        <div className="you-zone__table">
          <MeldArea
            melds={game.melds}
            team={game.yourTeam}
            hiddenIds={hiddenIds}
            addable={isYourTurn && selected.length > 0}
            onAddTo={addToMeld}
            emptyLabel={opened ? 'no melds yet' : 'your melds will lay down here'}
          />
          <RedThreeZone team={game.yourTeam} cards={game.redThrees[game.yourTeam] ?? []} hiddenIds={hiddenIds} />
        </div>

        <StagingTray
          groups={groups}
          total={stagedTotal}
          threshold={game.openingThreshold}
          needsThreshold={!opened}
          myMelds={game.melds[game.yourTeam] ?? {}}
          onToggleCard={toggleCard}
          onCycleWild={cycleWild}
          hiddenIds={hiddenIds}
        />

        <div className="action-bar">
          <span className={`action-bar__turn${isYourTurn ? ' is-you' : ''}`}>
            {isYourTurn ? (
              game.phase === 'draw' ? (
                'Your turn — draw from the stock or take the pile'
              ) : (
                'Your turn — meld or discard'
              )
            ) : isAway(game.currentPlayerId) ? (
              `Waiting for ${nameFor(game.currentPlayerId)} to come back…`
            ) : (
              `${nameFor(game.currentPlayerId)} is playing…`
            )}
          </span>

          {inAction && selected.length > 0 && (
            <button className="btn btn--primary" onClick={layDown}>
              {opened ? `Lay down ${groups.length > 1 ? `${groups.length} melds` : 'meld'}` : 'Open with these'}
            </button>
          )}
          {inAction && selected.length === 1 && (
            <button className="btn" onClick={() => sendAction({ type: 'DISCARD', cardId: selected[0] }, clearSelection)}>
              Discard
            </button>
          )}
          {selected.length > 0 && (
            <button className="btn btn--ghost" onClick={clearSelection}>
              Clear
            </button>
          )}
          {inAction && wouldStripHand && (
            <span className="action-bar__note">that leaves too few cards to finish the turn — going out needs a canasta</span>
          )}
          {inDraw && needsNaturalPair && (
            <span className="action-bar__note">
              your side has nothing down yet — the pile costs two {game.topDiscard?.rank}s from your hand, not one and a wild
            </span>
          )}
          {inDraw && selected.length > 0 && (
            <span className="action-bar__note">draw or take the pile first — then a meld will take these</span>
          )}
          {isYourTurn && !game.yourTeamHasCanasta && (
            <span className="action-bar__note">a canasta is needed before you can go out</span>
          )}
          {error && <span className="action-bar__error">{error}</span>}
        </div>

        <HandFan
          cards={game.yourHand}
          myId={myId}
          hiddenIds={hiddenIds}
          selectedIds={selected}
          onToggle={toggleCard}
        />
      </div>

      <FlightLayer flights={flights} legMs={legMs} />
    </div>
  );
}
