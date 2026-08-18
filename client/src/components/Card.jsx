const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function cardLabel(card) {
  if (card.rank === 'JOKER') return 'JOKER';
  return `${card.rank}${SUIT_SYMBOL[card.suit] ?? ''}`;
}

export function isRedCard(card) {
  return card.suit === 'H' || card.suit === 'D';
}

export function Card({ card, selected, onClick, disabled }) {
  const red = card.rank === 'JOKER' ? false : isRedCard(card);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card"
      style={{
        color: red ? '#b91c1c' : '#111827',
        borderColor: selected ? '#2563eb' : '#9ca3af',
        background: selected ? '#dbeafe' : '#ffffff',
      }}
    >
      {cardLabel(card)}
    </button>
  );
}
