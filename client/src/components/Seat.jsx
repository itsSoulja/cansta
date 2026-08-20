import { CardBack } from './Card.jsx';
import { MeldArea, RedThreeZone } from './MeldArea.jsx';
import { useAnchor } from '../anim/anchors.jsx';
import { ringSpot } from './ring.js';

// An opponent, sat at their place on the rim of the felt. Three pieces at the
// same angle, stepped off the rim: their hand outside the table, their
// nameplate on the edge of it, and whatever they have laid down inside.
const FAN_RADIUS = 1.2;
const MELD_RADIUS = 0.58;

export function Seat({ index, count: seatCount, name, cards, active, away, team, melds, redThrees, hiddenIds, showMelds, teamLabel }) {
  const handAnchor = useAnchor(`hand:${name.playerId}`);
  const visible = Math.min(cards, 10);
  const mid = (visible - 1) / 2;
  const spot = (radius) => ringSpot(index, seatCount, radius);

  return (
    <>
      <div className="ring-fan" style={spot(FAN_RADIUS)} ref={handAnchor}>
        {Array.from({ length: visible }).map((_, i) => (
          <div
            className="ring-fan__card"
            key={i}
            style={{ '--rot': `${(i - mid) * 3}deg`, '--lift': `${Math.abs(i - mid) ** 2 * 0.6}px` }}
          >
            <CardBack size="small" />
          </div>
        ))}
      </div>

      <div className={`ring-seat${active ? ' is-active' : ''}${away ? ' is-away' : ''}`} style={spot(1)}>
        <span className="ring-seat__avatar">{name.label.slice(0, 1).toUpperCase()}</span>
        <span className="ring-seat__name">{name.label}</span>
        <span className="ring-seat__count">{cards}</span>
        {(teamLabel || away) && (
          <span className="ring-seat__tags">
            {teamLabel && <em className="is-partner">{teamLabel}</em>}
            {away && <em className="is-away">away</em>}
          </span>
        )}
      </div>

      {showMelds && (
        <div className="ring-melds" style={spot(MELD_RADIUS)}>
          <MeldArea melds={melds} team={team} hiddenIds={hiddenIds} compact emptyLabel="" />
          <RedThreeZone team={team} cards={redThrees[team] ?? []} hiddenIds={hiddenIds} />
        </div>
      )}
    </>
  );
}
