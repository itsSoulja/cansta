const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function cardLabel(card) {
  if (card.rank === 'JOKER') return 'JOKER';
  return `${card.rank}${SUIT_SYMBOL[card.suit] ?? ''}`;
}

export function isRedCard(card) {
  return card.suit === 'H' || card.suit === 'D';
}

export function isWildCard(card) {
  return card.rank === '2' || card.rank === 'JOKER';
}

export function pointsFor(card, pointValues) {
  if (!pointValues) return 0;
  if (card.rank === '3') return pointValues[isRedCard(card) ? '3red' : '3black'] ?? 0;
  return pointValues[card.rank] ?? 0;
}

// 3 < 4 < ... < K < A < 2 < JOKER — naturals ascend normally, wilds group at the end.
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JOKER'];
const SUIT_ORDER = ['S', 'H', 'D', 'C'];

export function rankIndex(rank) {
  return RANK_ORDER.indexOf(rank);
}

// Ascending left-to-right, so a fanned hand reads low to high.
export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const rankDiff = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  });
}

export function Card({ card, selected, onClick, disabled, size, style, className = '', innerRef, static: isStatic }) {
  const red = card.rank !== 'JOKER' && isRedCard(card);
  const symbol = card.rank === 'JOKER' ? '★' : SUIT_SYMBOL[card.suit];
  const classes = [
    'playing-card',
    size ? `playing-card--${size}` : '',
    selected ? 'is-selected' : '',
    isWildCard(card) ? 'playing-card--wild' : '',
    red ? 'playing-card--red' : 'playing-card--black',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const face = (
    <>
      <span className="playing-card__index">
        <span className="playing-card__rank">{card.rank === 'JOKER' ? 'JK' : card.rank}</span>
        <span className="playing-card__suit">{symbol}</span>
      </span>
      <span className="playing-card__pip">{symbol}</span>
      <span className="playing-card__index playing-card__index--flip">
        <span className="playing-card__rank">{card.rank === 'JOKER' ? 'JK' : card.rank}</span>
        <span className="playing-card__suit">{symbol}</span>
      </span>
    </>
  );

  if (isStatic) {
    return (
      <div className={classes} style={style} ref={innerRef}>
        {face}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes} style={style} ref={innerRef}>
      {face}
    </button>
  );
}

export function CardBack({ size, style, className = '', innerRef }) {
  return (
    <div
      ref={innerRef}
      className={`playing-card playing-card--back ${size ? `playing-card--${size}` : ''} ${className}`}
      style={style}
    >
      <span className="playing-card__emblem">C</span>
    </div>
  );
}
