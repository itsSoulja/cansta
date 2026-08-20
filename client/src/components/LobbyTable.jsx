// The lobby's table. Everyone who has joined is sat around it, you at the
// bottom, and the ring closes up as people arrive — so the room fills in front
// of you instead of ticking down a list of empty slots.
//
// In team mode the sides alternate by arrival order, which is exactly how the
// server will pair them, so the colours here are the real thing rather than a
// guess.
const RADIUS_X = 42;
const RADIUS_Y = 38;

export function LobbyTable({ seats, myPlayerId, hostPlayerId, mode, waitingFor }) {
  // Rotate the ring so you are always the one at the bottom.
  const mine = seats.findIndex((s) => s.playerId === myPlayerId);
  const start = mine === -1 ? 0 : mine;
  const around = seats.map((_, i) => seats[(start + i) % seats.length]);

  return (
    <div className="lobby-table">
      <div className="lobby-table__felt">
        <span className="lobby-table__count">{seats.length}</span>
        <span className="lobby-table__label">{seats.length === 1 ? 'player' : 'players'}</span>
        {waitingFor && <span className="lobby-table__waiting">{waitingFor}</span>}
      </div>

      {around.map((seat, i) => {
        // Bottom of the ring is 90°, and the rest spread evenly from there.
        const angle = ((90 + (i * 360) / around.length) * Math.PI) / 180;
        const left = 50 + RADIUS_X * Math.cos(angle);
        const top = 50 + RADIUS_Y * Math.sin(angle);
        // Teams are cut from the arrival order, not the order you are seeing.
        const team = mode === 'teams' ? seats.indexOf(seat) % 2 : null;
        return (
          <div
            className={`lobby-seat${seat.playerId === myPlayerId ? ' is-you' : ''}${team !== null ? ` lobby-seat--team${team}` : ''}`}
            key={seat.playerId}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className="lobby-seat__avatar">{seat.name.slice(0, 1).toUpperCase()}</span>
            <span className="lobby-seat__name">{seat.name}</span>
            <span className="lobby-seat__tags">
              {seat.playerId === myPlayerId && <em>you</em>}
              {seat.playerId === hostPlayerId && <em>host</em>}
              {team !== null && <em className="lobby-seat__team">side {team === 0 ? 'A' : 'B'}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
