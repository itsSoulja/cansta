import { useState } from 'react';
import { AnchorProvider } from './anim/anchors.jsx';
import { useEasterEgg } from './hooks/useEasterEgg.js';
import { useGame } from './hooks/useGame.js';
import { Landing } from './pages/Landing.jsx';
import { Lobby } from './pages/Lobby.jsx';
import { Table } from './pages/Table.jsx';

export default function App() {
  const { connected, myId, lobby, game, error, createRoom, joinRoom, leaveRoom, startGame, sendAction, nextRound } = useGame();
  const [name, setName] = useState('');
  useEasterEgg(name);

  if (!connected) {
    return (
      <div className="boot">
        <div className="boot__pulse" />
        <p>Dealing you in…</p>
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
