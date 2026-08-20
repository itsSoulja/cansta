import { useState } from 'react';
import { AnchorProvider } from './anim/anchors.jsx';
import { useEasterEgg } from './hooks/useEasterEgg.js';
import { useGame } from './hooks/useGame.js';
import { rememberedRoom } from './session.js';
import { Landing } from './pages/Landing.jsx';
import { Lobby } from './pages/Lobby.jsx';
import { Table } from './pages/Table.jsx';

export default function App() {
  const { connected, restoring, myId, lobby, game, error, createRoom, joinRoom, leaveRoom, startGame, sendAction, nextRound } =
    useGame();
  // A reload should not cost you your easter egg, so the name comes back
  // with the seat.
  const [name, setName] = useState(() => rememberedRoom()?.name ?? '');
  useEasterEgg(name);

  // `restoring` is a tab that remembers a table and is asking for its seat
  // back; holding the boot screen keeps the landing page from flashing past.
  if (!connected || restoring) {
    return (
      <div className="boot">
        <div className="boot__pulse" />
        <p>{restoring ? 'Finding your seat…' : 'Dealing you in…'}</p>
      </div>
    );
  }

  if (game) {
    return (
      <AnchorProvider>
        <Table game={game} lobby={lobby} myId={myId} sendAction={sendAction} nextRound={nextRound} error={error} />
      </AnchorProvider>
    );
  }

  if (lobby) return <Lobby lobby={lobby} myId={myId} onStart={startGame} onLeave={leaveRoom} error={error} />;

  return <Landing onCreate={createRoom} onJoin={joinRoom} onNameChange={setName} error={error} />;
}
