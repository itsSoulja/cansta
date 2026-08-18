import { useMemo, useState } from 'react';
import { CenterPiles } from '../components/CenterPiles.jsx';
import { HandFan } from '../components/HandFan.jsx';
import { MeldArea, RedThreeZone } from '../components/MeldArea.jsx';
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

  const nameFor = (playerId) => lobby?.seats.find((s) => s && s.socketId === playerId)?.name ?? 'Player';

  const { flights, hiddenIds, legMs } = useCardFlights({ events: game.events, myId });

  const isYourTurn = game.currentPlayerId === myId;
  const opened = game.initialMeldMade[game.yourTeam];
  const inDraw = isYourTurn && game.phase === 'draw';
  const inAction = isYourTurn && game.phase === 'action';
  const canDiscardHere = inAction && selected.length === 1;
  const canTakePile = inDraw && game.canTakeDiscard;

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

  // Seat the opponents in turn order starting from the player after you, so the
  // turn visibly travels around the table.
  const opponents = useMemo(() => {
    const order = game.playerIds;
    const mine = order.indexOf(myId);
    return order.slice(mine + 1).concat(order.slice(0, mine));
  }, [game.playerIds, myId]);

  // In 2v2 a team shares one meld area: yours sits in front of you, theirs in
  // front of the first opponent on that team.
  const meldSeatByTeam = useMemo(() => {
    const map = {};
    for (const team of game.teams) {
      map[team] = team === game.yourTeam ? myId : game.playerIds.find((pid) => game.teamsByPlayer[pid] === team);
    }
    return map;
  }, [game.teams, game.yourTeam, game.playerIds, game.teamsByPlayer, myId]);

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
    if (!inAction || selected.length === 0) return;
    sendAction({ type: 'MELD', cardIds: selected, targetRank: rank }, (res) => {
      if (res.ok) clearSelection();
    });
  };

  if (game.matchOver || game.roundOver) {
    const isHost = lobby?.hostSocketId === myId;
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
            (isHost ? (
              <button className="btn btn--primary" onClick={nextRound}>
                Deal the next round
              </button>
            ) : (
              <p className="summary-card__wait">Waiting for the host to deal…</p>
            ))}
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
        <span className="table-top__brand">
          Cansta <span className="table-top__round">Round {game.round}</span>
        </span>
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
            addable={inAction && selected.length > 0}
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
