import { useMemo, useState } from 'react';
import { Card, cardLabel } from '../components/Card.jsx';
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
      <div style={{ maxWidth: 600, margin: '4rem auto', fontFamily: 'sans-serif' }}>
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
      <div style={{ maxWidth: 600, margin: '4rem auto', fontFamily: 'sans-serif' }}>
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
        {isHost ? <button onClick={nextRound}>Start next round</button> : <p>Waiting for host to start the next round...</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Cansta — Round {game.round}</h1>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      <p>
        <strong>{isYourTurn ? "Your turn" : `Waiting for ${nameFor(lobby, game.currentPlayerId)}`}</strong>
        {' — '}phase: {game.phase}
      </p>

      <ScorePanel game={game} />

      <hr />
      <h3>Table</h3>
      <p>
        Stock: {game.stockCount} cards &nbsp;|&nbsp; Discard pile ({game.discardCount}):{' '}
        {game.topDiscard ? cardLabel(game.topDiscard) : 'empty'}
        {game.discardBlockedFor === myId && ' (blocked for you this turn)'}
      </p>

      <MeldArea melds={game.melds} teams={game.teams} yourTeam={game.yourTeam} targetRank={targetRank} onPickTarget={setTargetRank} />

      <hr />
      <h3>Your hand</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {game.yourHand.map((c) => (
          <Card key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggleCard(c.id)} />
        ))}
      </div>

      {isYourTurn && (
        <div style={{ marginTop: 16 }}>
          {game.phase === 'draw' && (
            <>
              <button onClick={drawStock}>Draw from stock</button>{' '}
              <button onClick={takeDiscard} disabled={!game.topDiscard || game.discardBlockedFor === myId || !opened}>
                Take discard pile
              </button>
              {!opened && <p style={{ color: '#6b7280' }}>Your side must open before taking the discard pile.</p>}
            </>
          )}

          {game.phase === 'action' && !opened && (
            <div>
              <p>Build your opening meld (needs enough total value for your side's threshold).</p>
              <button onClick={addGroup} disabled={selected.length < 1}>
                Add selected cards as a group
              </button>
              <ul>
                {stagedGroups.map((g, i) => (
                  <li key={i}>
                    {g.length} card(s){' '}
                    <button onClick={() => removeGroup(i)}>remove</button>
                  </li>
                ))}
              </ul>
              <button onClick={submitOpenMeld} disabled={stagedTotal < 3}>
                Submit opening meld
              </button>
            </div>
          )}

          {game.phase === 'action' && opened && (
            <>
              <button onClick={meld} disabled={selected.length < 1}>
                {targetRank ? `Add to ${targetRank}s` : 'Meld selected as new group'}
              </button>{' '}
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
