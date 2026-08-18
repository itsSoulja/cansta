// A red 3 pays out only to a side with a meld down; until then it is a debt,
// so the scoreboard shows the signed total rather than a bare count.
function redThreePoints(game, team) {
  const count = (game.redThrees[team] ?? []).length;
  const value = count === 4 ? 800 : count * 100;
  return game.initialMeldMade[team] ? `+${value}` : `−${value}`;
}

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
                <span className={`tag tag--red${game.initialMeldMade[team] ? '' : ' tag--against'}`}>
                  {game.redThrees[team].length} red 3 · {redThreePoints(game, team)}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
