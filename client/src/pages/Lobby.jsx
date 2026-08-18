export function Lobby({ lobby, myId, onStart, error }) {
  const isHost = lobby.hostSocketId === myId;
  const full = lobby.seats.every((s) => s !== null);

  return (
    <div style={{ maxWidth: 420, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>Cansta</h1>
      <p>
        Room code: <strong style={{ fontSize: '1.5rem', letterSpacing: 2 }}>{lobby.code}</strong>
      </p>
      <p>Share this code with your friends so they can join.</p>
      <p>
        Mode: {lobby.mode} {lobby.mode === '2v2' && `(${lobby.packCount} packs)`}
      </p>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <h3>Seats</h3>
      <ol>
        {lobby.seats.map((seat, i) => (
          <li key={i}>{seat ? `${seat.name}${seat.socketId === myId ? ' (you)' : ''}` : 'Waiting for player...'}</li>
        ))}
      </ol>

      {isHost ? (
        <button disabled={!full} onClick={onStart}>
          {full ? 'Start Game' : 'Waiting for all seats to fill...'}
        </button>
      ) : (
        <p>Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
