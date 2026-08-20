export function Lobby({ lobby, myId, onStart, onLeave, error }) {
  const isHost = lobby.hostPlayerId === myId;
  const full = lobby.seats.every((s) => s !== null);
  const taken = lobby.seats.filter(Boolean).length;

  return (
    <div className="portal">
      <div className="portal__glow" />
      <div className="portal__inner">
        {/* A lobby is easy to open by mistake, so the way out sits where a
            back button always sits rather than at the foot of the page. */}
        <button type="button" className="portal__back" onClick={onLeave}>
          <span className="portal__back-arrow" aria-hidden="true">←</span>
          Back
        </button>
        <h1 className="portal__title">Cansta</h1>

        <section className="panel panel--code">
          <span className="panel__title">Room code</span>
          <strong className="room-code">{lobby.code}</strong>
          <p className="panel__hint">Share it — anyone with the code can take a seat.</p>
        </section>

        {error && <p className="portal__error">{error}</p>}

        <section className="panel">
          <h2 className="panel__title">
            Seats <span className="panel__count">{taken}/{lobby.seats.length}</span>
            <span className="panel__mode">
              {lobby.mode}
              {lobby.mode !== '1v1' && ` · ${lobby.packCount} packs`}
            </span>
          </h2>
          <ul className="seat-list">
            {lobby.seats.map((seat, i) => (
              <li key={i} className={`seat-list__row${seat ? ' is-filled' : ''}`}>
                <span className="seat-list__avatar">{seat ? seat.name.slice(0, 1).toUpperCase() : '·'}</span>
                <span className="seat-list__name">
                  {seat ? seat.name : 'waiting…'}
                  {seat?.playerId === myId && <span className="seat-list__you">you</span>}
                  {seat?.playerId === lobby.hostPlayerId && <span className="seat-list__host">host</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <button className="btn btn--primary btn--wide" disabled={!full} onClick={onStart}>
            {full ? 'Start the game' : `Waiting for ${lobby.seats.length - taken} more…`}
          </button>
        ) : (
          <p className="portal__wait">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}
