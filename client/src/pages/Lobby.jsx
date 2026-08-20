import { LobbyTable } from '../components/LobbyTable.jsx';

const MODE_LABEL = { free: 'Free-for-all', teams: 'Teams' };

export function Lobby({ lobby, myId, onStart, onLeave, error }) {
  const isHost = lobby.hostPlayerId === myId;
  const ready = !lobby.startBlocker;

  return (
    <div className="portal">
      <div className="portal__glow" />
      <div className="portal__inner portal__inner--wide">
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
          <p className="panel__hint">
            {MODE_LABEL[lobby.mode] ?? lobby.mode} · {lobby.minSeats}–{lobby.maxSeats} players. Share the code — anyone
            with it can pull up a chair.
          </p>
        </section>

        {error && <p className="portal__error">{error}</p>}

        <LobbyTable
          seats={lobby.seats}
          myPlayerId={myId}
          hostPlayerId={lobby.hostPlayerId}
          mode={lobby.mode}
          waitingFor={lobby.startBlocker}
        />

        {isHost ? (
          <button className="btn btn--primary btn--wide" disabled={!ready} onClick={onStart}>
            {ready ? `Deal the cards — ${lobby.seats.length} playing` : lobby.startBlocker}
          </button>
        ) : (
          <p className="portal__wait">{ready ? 'Ready — waiting for the host to deal…' : lobby.startBlocker}</p>
        )}
      </div>
    </div>
  );
}
