const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function cardLabel(card) {
  if (card.rank === 'JOKER') return 'JOKER';
  return `${card.rank}${SUIT_SYMBOL[card.suit] ?? ''}`;
}

export function isRedCard(card) {
  return card.suit === 'H' || card.suit === 'D';
}

// 3 < 4 < ... < K < A < 2 < JOKER — naturals ascend normally, wilds group at the end.
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JOKER'];
const SUIT_ORDER = ['S', 'H', 'D', 'C'];

export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const rankDiff = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  });
}

export function Card({ card, selected, onClick, disabled }) {
  const red = card.rank !== 'JOKER' && isRedCard(card);
  const symbol = card.rank === 'JOKER' ? '★' : SUIT_SYMBOL[card.suit];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`playing-card${selected ? ' playing-card--selected' : ''}`}
      style={{ color: red ? 'var(--card-red)' : 'var(--card-black)' }}
    >
      {card.rank === 'JOKER' ? (
        <span className="playing-card__joker">JOKER</span>
      ) : (
        <>
          <span className="playing-card__corner playing-card__corner--top">
            {card.rank}
            <br />
            {symbol}
          </span>
          <span className="playing-card__pip">{symbol}</span>
          <span className="playing-card__corner playing-card__corner--bottom">
            {card.rank}
            <br />
            {symbol}
          </span>
        </>
      )}
    </button>
  );
}

export function CardBack({ small }) {
  return <div className={`playing-card playing-card__back${small ? ' playing-card--small' : ''}`} />;
}
