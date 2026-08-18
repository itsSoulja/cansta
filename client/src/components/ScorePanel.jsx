import { cardLabel } from './Card.jsx';

export function ScorePanel({ game }) {
  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      {game.teams.map((team) => (
        <div key={team} style={{ minWidth: 180 }}>
          <h4>{team === game.yourTeam ? 'Your team' : 'Opponent team'}</h4>
          <div>Score: {game.scores[team]}</div>
          <div>Opened: {game.initialMeldMade[team] ? 'Yes' : 'No'}</div>
          <div>
            Red 3s: {(game.redThrees[team] ?? []).map(cardLabel).join(' ') || 'none'}
          </div>
        </div>
      ))}
    </div>
  );
}
