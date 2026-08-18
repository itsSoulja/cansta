export function ScorePanel({ game, nameFor }) {
  return (
    <div className="scoreboard">
      {game.teams.map((team) => {
        const members = game.playerIds.filter((pid) => game.teamsByPlayer[pid] === team);
        const label = team === game.yourTeam ? 'You' : members.map(nameFor).join(' & ');
        return (
          <div key={team} className={`scoreboard__team${team === game.yourTeam ? ' is-you' : ''}`}>
            <span className="scoreboard__name">{label}</span>
            <span className="scoreboard__score">{game.scores[team]}</span>
            <span className="scoreboard__tags">
              {!game.initialMeldMade[team] && <span className="tag">not opened</span>}
              {(game.redThrees[team] ?? []).length > 0 && (
                <span className="tag tag--red">{game.redThrees[team].length} red 3</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
