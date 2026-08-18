import { cardLabel } from './Card.jsx';

export function ScorePanel({ game, compact }) {
  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
        {game.teams.map((team) => (
          <span key={team}>
            <strong>{team === game.yourTeam ? 'You' : 'Them'}:</strong> {game.scores[team]}
            {game.redThrees[team]?.length > 0 && ` · ${game.redThrees[team].length} red 3s`}
            {!game.initialMeldMade[team] && ' · not opened'}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      {game.teams.map((team) => (
        <div key={team} style={{ minWidth: 180 }}>
          <h4>{team === game.yourTeam ? 'Your team' : 'Opponent team'}</h4>
          <div>Score: {game.scores[team]}</div>
          <div>Opened: {game.initialMeldMade[team] ? 'Yes' : 'No'}</div>
          <div>Red 3s: {(game.redThrees[team] ?? []).map(cardLabel).join(' ') || 'none'}</div>
        </div>
      ))}
    </div>
  );
}
