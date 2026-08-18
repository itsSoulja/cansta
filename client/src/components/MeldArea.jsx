import { Card } from './Card.jsx';
import { useAnchor } from '../anim/anchors.jsx';

// One melded rank, cards overlapping like a real stack laid on the table.
function MeldGroup({ team, rank, shape, hiddenIds, onClick, addable, compact }) {
  const anchor = useAnchor(`meld:${team}:${rank}`);
  const classes = [
    'meld-group',
    shape.isCanasta ? (shape.isNatural ? 'meld-group--natural' : 'meld-group--mixed') : '',
    addable ? 'meld-group--addable' : '',
    compact ? 'meld-group--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} ref={anchor} onClick={addable ? onClick : undefined} title={addable ? `Add to the ${rank}s` : undefined}>
      <div className="meld-group__cards">
        {shape.cards.map((card, i) => (
          <div className="meld-group__slot" key={card.id} style={{ '--i': i }}>
            <Card card={card} size={compact ? 'tiny' : 'small'} static className={hiddenIds.has(card.id) ? 'is-flying' : ''} />
          </div>
        ))}
      </div>
      {shape.isCanasta && (
        <span className="meld-group__badge">{shape.isNatural ? 'CANASTA' : 'CANASTA ·'} {shape.cards.length}</span>
      )}
    </div>
  );
}

export function MeldArea({ melds, team, hiddenIds, onAddTo, addable, compact, emptyLabel }) {
  const ranks = Object.keys(melds[team] ?? {}).sort(
    (a, b) => (melds[team][b]?.cards.length ?? 0) - (melds[team][a]?.cards.length ?? 0),
  );

  if (ranks.length === 0) {
    return <div className="meld-area meld-area--empty">{emptyLabel ?? 'no melds yet'}</div>;
  }

  return (
    <div className={`meld-area${compact ? ' meld-area--compact' : ''}`}>
      {ranks.map((rank) => (
        <MeldGroup
          key={rank}
          team={team}
          rank={rank}
          shape={melds[team][rank]}
          hiddenIds={hiddenIds}
          addable={addable}
          compact={compact}
          onClick={() => onAddTo?.(rank)}
        />
      ))}
    </div>
  );
}

// Red 3s live off to the side of their owner's seat, face up, out of the way.
export function RedThreeZone({ team, cards, hiddenIds }) {
  const anchor = useAnchor(`redthree:${team}`);
  return (
    <div className={`red-three-zone${cards.length ? ' is-filled' : ''}`} ref={anchor}>
      {cards.map((card, i) => (
        <div className="red-three-zone__slot" key={card.id} style={{ '--i': i }}>
          <Card card={card} size="tiny" static className={hiddenIds.has(card.id) ? 'is-flying' : ''} />
        </div>
      ))}
    </div>
  );
}
