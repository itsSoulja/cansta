import { useMemo, useState } from 'react';
import { Card, CardBack, cardLabel, sortHand } from '../components/Card.jsx';
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

  const toggleCard = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => {
    setSelected([]);
    setTargetRank(null);
  };

  const drawStock = () => sendAction({ type: 'DRAW_STOCK' });

  const takeDiscard = () =>
    sendAction({ type: 'TAKE_DISCARD', cardIds: selected, targetRank: targetRank || undefined }, () => clearSelection());

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
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '0 1rem' }}>
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
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '0 1rem' }}>
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
    <div style={{ maxWidth: 1000, margin: '1.5rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 4 }}>Cansta — Round {game.round}</h1>
      {error && <p style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</p>}

      <ScorePanel game={game} />

      <div className={`turn-banner ${isYourTurn ? 'turn-banner--you' : 'turn-banner--them'}`}>
        {isYourTurn ? "YOUR TURN" : `${nameFor(lobby, game.currentPlayerId)}'s turn`}
        {' · '}
        {game.phase === 'draw' ? 'draw a card' : 'meld or discard'}
      </div>

      <div className="table-felt">
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
                  {nameFor(lobby, pid)} {sameTeam ? '(partner)' : ''}
                </div>
                <div className="opponent-panel__backs">
                  {Array.from({ length: count }).map((_, i) => (
                    <CardBack key={i} small />
                  ))}
                </div>
                <div className="pile-label">{count} cards</div>
              </div>
            );
          })}
        </div>

        <div className="center-row">
          <div>
            <CardBack />
            <div className="pile-label">Stock: {game.stockCount}</div>
          </div>
          <div>
            {game.topDiscard ? <Card card={game.topDiscard} disabled /> : <div className="playing-card" style={{ opacity: 0.3 }} />}
            <div className="pile-label">
              Discard ({game.discardCount}){game.discardBlockedFor === myId && ' — blocked for you'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '0.75rem 1rem', margin: '1rem 0' }}>
        <MeldArea melds={game.melds} teams={game.teams} yourTeam={game.yourTeam} targetRank={targetRank} onPickTarget={setTargetRank} />
      </div>

      <h3 style={{ marginBottom: 4 }}>Your hand</h3>
      <div className="hand-row">
        {sortedHand.map((c) => (
          <Card key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggleCard(c.id)} />
        ))}
      </div>

      {isYourTurn && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {game.phase === 'draw' && (
            <>
              <button className="primary" onClick={drawStock}>
                Draw from stock
              </button>
              <button onClick={takeDiscard} disabled={!game.topDiscard || game.discardBlockedFor === myId || !opened}>
                Take discard pile
              </button>
              {!opened && <span style={{ color: '#6b7280' }}>Your side must open before taking the discard pile.</span>}
            </>
          )}

          {game.phase === 'action' && (
            <>
              {!opened && (
                <>
                  <button onClick={addGroup} disabled={selected.length < 1}>
                    Add selected as opening group ({stagedTotal} staged)
                  </button>
                  {stagedGroups.map((g, i) => (
                    <span key={i} style={{ fontSize: '0.85rem' }}>
                      group of {g.length} <button onClick={() => removeGroup(i)}>✕</button>
                    </span>
                  ))}
                  <button className="primary" onClick={submitOpenMeld} disabled={stagedTotal < 3}>
                    Submit opening meld
                  </button>
                </>
              )}

              {opened && (
                <button onClick={meld} disabled={selected.length < 1}>
                  {targetRank ? `Add to ${targetRank}s` : 'Meld selected as new group'}
                </button>
              )}

              <button onClick={discard} disabled={selected.length !== 1}>
                Discard selected card
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
