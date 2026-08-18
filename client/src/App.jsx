import { useGame } from './hooks/useGame.js';
import { Landing } from './pages/Landing.jsx';
import { Lobby } from './pages/Lobby.jsx';
import { Table } from './pages/Table.jsx';

export default function App() {
  const { connected, myId, lobby, game, error, createRoom, joinRoom, startGame, sendAction, nextRound } = useGame();

  if (!connected) {
    return <p style={{ textAlign: 'center', marginTop: '4rem', fontFamily: 'sans-serif' }}>Connecting...</p>;
  }

  if (game) {
    return <Table game={game} lobby={lobby} myId={myId} sendAction={sendAction} nextRound={nextRound} error={error} />;
  }

  if (lobby) {
    return <Lobby lobby={lobby} myId={myId} onStart={startGame} error={error} />;
  }

  return <Landing onCreate={createRoom} onJoin={joinRoom} error={error} />;
}
