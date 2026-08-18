import { cardLabel } from './Card.jsx';

export function MeldArea({ melds, teams, yourTeam, targetRank, onPickTarget }) {
  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      {teams.map((team) => {
        const ranks = Object.keys(melds[team] ?? {});
        const isYours = team === yourTeam;
        return (
          <div key={team} style={{ minWidth: 200 }}>
            <h4>{isYours ? 'Your team' : 'Opponent team'} melds</h4>
            {ranks.length === 0 && <p style={{ color: '#6b7280' }}>None yet</p>}
            {ranks.map((rank) => {
              const shape = melds[team][rank];
              const selectable = isYours;
              const active = targetRank === rank;
              return (
                <div
                  key={rank}
                  onClick={selectable ? () => onPickTarget(active ? null : rank) : undefined}
                  style={{
                    cursor: selectable ? 'pointer' : 'default',
                    border: active ? '2px solid #2563eb' : '1px solid #d1d5db',
                    borderRadius: 6,
                    padding: '0.4rem 0.6rem',
                    marginBottom: 6,
                    background: shape.isCanasta ? (shape.isNatural ? '#fef3c7' : '#e5e7eb') : '#f9fafb',
                  }}
                >
                  <strong>{rank}</strong>{' '}
                  <span style={{ color: '#6b7280' }}>
                    ({shape.cards.length} card{shape.cards.length === 1 ? '' : 's'}
                    {shape.isCanasta ? `, ${shape.isNatural ? 'natural' : 'mixed'} canasta` : ''})
                  </span>
                  <div style={{ fontSize: '0.85rem' }}>{shape.cards.map(cardLabel).join(' ')}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
