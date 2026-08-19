import { Card, cardLabel, sortHand } from './Card.jsx';
import { useAnchor } from '../anim/anchors.jsx';

// Your hand, laid out along a shallow arc so it reads like cards held above the
// table. Hovering lifts a card clear of its neighbours before you commit.
//
// The slot is the button, not the card: the card lifts on hover but the slot
// never moves, so the part of the fan that answers the pointer stays exactly
// where the eye left it. Reaching for the next card along used to mean fighting
// the raised card that had just grown over it.
export function HandFan({ cards, myId, hiddenIds, selectedIds, onToggle }) {
  const anchor = useAnchor(`hand:${myId}`);
  const shown = sortHand(cards).filter((c) => !selectedIds.includes(c.id));
  const mid = (shown.length - 1) / 2;
  const spread = Math.min(3.4, 46 / Math.max(shown.length, 1));

  return (
    <div className="hand-fan" ref={anchor}>
      {shown.map((card, i) => {
        const offset = i - mid;
        const rot = offset * spread;
        const lift = (1 - Math.cos((rot * Math.PI) / 180)) * 340;
        return (
          <button
            type="button"
            className={`hand-fan__slot${hiddenIds.has(card.id) ? ' is-flying' : ''}`}
            key={card.id}
            style={{ '--rot': `${rot}deg`, '--lift': `${lift}px`, '--i': i }}
            onClick={() => onToggle(card.id)}
            aria-label={cardLabel(card)}
          >
            <Card card={card} static />
          </button>
        );
      })}
    </div>
  );
}
