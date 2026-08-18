import { CardBack } from './Card.jsx';
import { MeldArea, RedThreeZone } from './MeldArea.jsx';
import { useAnchor } from '../anim/anchors.jsx';

// An opponent's side of the table: nameplate, a fan of face-down cards, and
// whatever they have laid down, so you can read their melds at a glance.
export function Seat({ position, name, count, active, team, melds, redThrees, hiddenIds, showMelds, teamLabel }) {
  const handAnchor = useAnchor(`hand:${name.playerId}`);
  const visible = Math.min(count, 16);
  const mid = (visible - 1) / 2;

  return (
    <div className={`seat seat--${position}${active ? ' seat--active' : ''}`}>
      <div className="seat__plate">
        <span className="seat__avatar">{name.label.slice(0, 1).toUpperCase()}</span>
        <span className="seat__name">
          {name.label}
          {teamLabel && <span className="seat__team">{teamLabel}</span>}
        </span>
        <span className="seat__count">{count}</span>
      </div>

      <div className="seat__hand" ref={handAnchor}>
        {Array.from({ length: visible }).map((_, i) => (
          <div
            className="seat__card"
            key={i}
            style={{ '--rot': `${(i - mid) * 3}deg`, '--lift': `${Math.abs(i - mid) ** 2 * 0.6}px` }}
          >
            <CardBack size="small" />
          </div>
        ))}
      </div>

      {showMelds && (
        <div className="seat__melds">
          <MeldArea melds={melds} team={team} hiddenIds={hiddenIds} compact emptyLabel="—" />
          <RedThreeZone team={team} cards={redThrees[team] ?? []} hiddenIds={hiddenIds} />
        </div>
      )}
    </div>
  );
}
