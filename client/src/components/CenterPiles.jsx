import { Card, CardBack } from './Card.jsx';
import { useAnchor } from '../anim/anchors.jsx';

// The stock and the discard pile. Whichever one you may take from pulses
// slowly on your turn, so you always know the table is waiting on you.
export function CenterPiles({ game, canDraw, canTakePile, canDiscardHere, onDrawStock, onPileClick, hiddenIds, selectedCount }) {
  const stockAnchor = useAnchor('stock');
  const discardAnchor = useAnchor('discard');
  const topHidden = game.topDiscard && hiddenIds.has(game.topDiscard.id);

  return (
    <div className="center-piles">
      <div className="pile-slot">
        <button
          type="button"
          className={`pile pile--stock${canDraw ? ' pile--live' : ''}`}
          onClick={onDrawStock}
          disabled={!canDraw}
          ref={stockAnchor}
        >
          <span className="pile__stack">
            <CardBack size="large" />
          </span>
        </button>
        <span className="pile__label">Stock · {game.stockCount}</span>
      </div>

      <div className="pile-slot">
        <button
          type="button"
          className={`pile pile--discard${canTakePile ? ' pile--live' : ''}${canDiscardHere ? ' pile--target' : ''}`}
          onClick={onPileClick}
          disabled={!canTakePile && !canDiscardHere}
          ref={discardAnchor}
          title={canDiscardHere ? 'Discard the selected card' : game.takeDiscardReason ?? 'Take the pile'}
        >
          {game.topDiscard ? (
            <Card card={game.topDiscard} size="large" static className={topHidden ? 'is-flying' : ''} />
          ) : (
            <span className="pile__empty" />
          )}
        </button>
        <span className="pile__label">Discard · {game.discardCount}</span>
        {canDiscardHere && <span className="pile__hint">click to discard</span>}
        {canTakePile && !canDiscardHere && (
          <span className="pile__hint">
            {selectedCount > 0 ? 'click to take the pile' : 'select the cards to meld it with'}
          </span>
        )}
        {canDraw && !canTakePile && game.takeDiscardReason && (
          <span className="pile__hint pile__hint--blocked">{game.takeDiscardReason}</span>
        )}
      </div>
    </div>
  );
}
