import { useMemo, useState } from 'react';
import { Card, CardBack, sortHand } from '../components/Card.jsx';
import { MeldArea } from '../components/MeldArea.jsx';
import { ScorePanel } from '../components/ScorePanel.jsx';

function nameFor(lobby, playerId) {
  const seat = lobby?.seats.find((s) => s && s.socketId === playerId);
  return seat ? seat.name : playerId;
}

export function Table({ game, lobby, myId, sendAction, nextRound, error }) {
  const [selected, setSelected] = useState([]);
  const [stagedGroups, setStagedGroups] = useState([]);
  const [targetRank, setTargetRank] = useState(null);

  const isYourTurn = game.currentPlayerId === myId;
  const opened = game.initialMeldMade[game.yourTeam];
  const sortedHand = useMemo(() => sortHand(game.yourHand), [game.yourHand]);
  const otherPlayers = game.playerIds.filter((pid) => pid !== myId);

  const inDraw = isYourTurn && game.phase === 'draw';
  const inAction = isYourTurn && game.phase === 'action';
  const pileClickable = inDraw && game.canTakeDiscard;

  const toggleCard = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => {
    setSelected([]);
    setTargetRank(null);
  };

  const drawStock = () => {
    if (!inDraw) return;
    sendAction({ type: 'DRAW_STOCK' });
  };

  const takeDiscard = () => {
    if (!pileClickable || selected.length < 2) return;
    sendAction({ type: 'TAKE_DISCARD', cardIds: selected }, () => clearSelection());
  };

  const addGroup = () => {
    if (selected.length < 1) return;
    setStagedGroups((prev) => [...prev, selected]);
    setSelected([]);
  };

  const removeGroup = (idx) => setStagedGroups((prev) => prev.filter((_, i) => i !== idx));

  const submitOpenMeld = () =>
    sendAction({ type: 'OPEN_MELD', groups: stagedGroups }, (res) => {
      if (res.ok) setStagedGroups([]);
    });

  const meld = () =>
    sendAction({ type: 'MELD', cardIds: selected, targetRank: targetRank || undefined }, () => clearSelection());

  const discard = () => {
    if (selected.length !== 1) return;
    sendAction({ type: 'DISCARD', cardId: selected[0] }, () => clearSelection());
  };

  const stagedTotal = useMemo(() => stagedGroups.reduce((sum, g) => sum + g.length, 0), [stagedGroups]);

  if (game.matchOver) {
    return (
      <div className="screen-center">
        <h1>Match over!</h1>
        <p>{game.winner === game.yourTeam ? 'Your team wins!' : 'The other team wins.'}</p>
        <ScorePanel game={game} />
      </div>
    );
  }

  if (game.roundOver) {
    const isHost = lobby?.hostSocketId === myId;
    const summary = game.lastRoundSummary;
    return (
      <div className="screen-center">
        <h1>Round {game.round} over</h1>
        {summary?.wentOutTeam != null ? (
          <p>
            {summary.wentOutTeam === game.yourTeam ? 'Your team' : 'The other team'} went out
            {summary.concealedGoOut ? ' with a concealed hand!' : '.'}
          </p>
        ) : (
          <p>The stock ran out — round ends with no one going out.</p>
        )}
        <ScorePanel game={game} />
        {isHost ? (
          <button className="primary" onClick={nextRound}>
            Start next round
          </button>
        ) : (
          <p>Waiting for host to start the next round...</p>
        )}
      </div>
    );
  }

  return (
    <div className="game-shell">
      <header className="game-header">
        <span className="game-header__title">Cansta · Round {game.round}</span>
        <ScorePanel game={game} compact />
      </header>

      <div className={`turn-banner ${isYourTurn ? 'turn-banner--you' : 'turn-banner--them'}`}>
        {isYourTurn ? 'YOUR TURN' : `${nameFor(lobby, game.currentPlayerId)}'s turn`}
        {' · '}
        {game.phase === 'draw' ? 'draw from the stock or take the discard pile' : 'meld or discard'}
        {error && <span className="turn-banner__error">{error}</span>}
      </div>

      <main className="game-main">
        <section className="table-felt">
          <div className="opponent-row">
            {otherPlayers.map((pid) => {
              const handInfo = game.hands[pid];
              const count = typeof handInfo === 'object' && 'count' in handInfo ? handInfo.count : 0;
              const sameTeam = game.teamsByPlayer[pid] === game.yourTeam;
              return (
                <div
                  key={pid}
                  className={`opponent-panel${game.currentPlayerId === pid ? ' opponent-panel--active' : ''}`}
                >
                  <div className="opponent-panel__name">
                    <span className={`avatar-circle${game.currentPlayerId === pid ? ' avatar-circle--active' : ''}`}>
                      {nameFor(lobby, pid).slice(0, 1).toUpperCase()}
                    </span>
                    {nameFor(lobby, pid)}
                    {sameTeam ? ' (partner)' : ''}
                  </div>
                  <div className="opponent-panel__backs">
                    {Array.from({ length: Math.min(count, 14) }).map((_, i) => (
                      <CardBack key={i} small />
                    ))}
                  </div>
                  <div className="pile-label">{count} cards</div>
                </div>
              );
            })}
          </div>

          <div className="center-row">
            <div className={`pile${inDraw ? ' pile--clickable' : ''}`} onClick={drawStock}>
              <CardBack large />
              <div className="pile-label">Stock: {game.stockCount}</div>
              {inDraw && <div className="pile-hint">click to draw</div>}
            </div>

            <div
              className={`pile${pileClickable ? ' pile--clickable pile--available' : ''}`}
              onClick={takeDiscard}
              title={game.takeDiscardReason ?? 'You can take this pile'}
            >
              {game.topDiscard ? (
                <Card card={game.topDiscard} disabled large />
              ) : (
                <div className="playing-card playing-card--large" style={{ opacity: 0.3 }} />
              )}
              <div className="pile-label">Discard ({game.discardCount})</div>
              {pileClickable && (
                <div className="pile-hint">
                  {selected.length >= 2 ? 'click to take pile' : 'select 2+ matching cards first'}
                </div>
              )}
              {inDraw && !pileClickable && game.takeDiscardReason && (
                <div className="pile-hint pile-hint--blocked">{game.takeDiscardReason}</div>
              )}
            </div>
          </div>
        </section>

        <section className="meld-panel">
          <MeldArea
            melds={game.melds}
            teams={game.teams}
            yourTeam={game.yourTeam}
            targetRank={targetRank}
            onPickTarget={setTargetRank}
          />
        </section>
      </main>

      <footer className="game-footer">
        <div className="action-bar">
          {!isYourTurn && <span className="action-bar__wait">Waiting for your turn…</span>}

          {inAction && !opened && (
            <>
              <button onClick={addGroup} disabled={selected.length < 1}>
                Stage group ({stagedTotal} staged)
              </button>
              {stagedGroups.map((g, i) => (
                <span key={i} className="staged-chip">
                  {g.length} cards <button onClick={() => removeGroup(i)}>✕</button>
                </span>
              ))}
              <button className="primary" onClick={submitOpenMeld} disabled={stagedTotal < 3}>
                Submit opening meld
              </button>
            </>
          )}

          {inAction && opened && (
            <button onClick={meld} disabled={selected.length < 1}>
              {targetRank ? `Add to ${targetRank}s` : 'Meld selected'}
            </button>
          )}

          {inAction && (
            <button onClick={discard} disabled={selected.length !== 1}>
              Discard selected
            </button>
          )}

          {isYourTurn && !game.yourTeamHasCanasta && (
            <span className="action-bar__note">You need a canasta before you can go out</span>
          )}
        </div>

        {selected.length > 0 && (
          <div className="selected-tray">
            <span className="selected-tray__label">Selected ({selected.length}) — click to return</span>
            {selected.map((id) => {
              const c = game.yourHand.find((x) => x.id === id);
              if (!c) return null;
              return <Card key={id} card={c} selected onClick={() => toggleCard(id)} />;
            })}
          </div>
        )}

        <div className="hand-fan">
          {sortedHand
            .filter((c) => !selected.includes(c.id))
            .map((c, i, arr) => {
              const mid = (arr.length - 1) / 2;
              const rotate = (i - mid) * Math.min(3, 40 / Math.max(arr.length, 1));
              return (
                <div key={c.id} className="hand-fan__card" style={{ transform: `rotate(${rotate}deg)` }}>
                  <Card card={c} onClick={() => toggleCard(c.id)} />
                </div>
              );
            })}
        </div>
      </footer>
    </div>
  );
}
