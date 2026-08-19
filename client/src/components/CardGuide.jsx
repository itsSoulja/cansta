import { useState } from 'react';
import { Card } from './Card.jsx';

/* ── The card guide ───────────────────────────────────────────────────────
   Shared by the full rules book on the landing screen and the summary the
   table shows while you hold the button down. This is presentation only —
   the engine still decides everything. The point values mirror
   `server/src/game/card.js`, and anywhere a live game is in hand the
   server's own `pointValues` are used in preference to these.            */

let n = 0;
const sample = (rank, suit) => ({ id: `guide${n++}`, rank, suit });

export const CARD_ROWS = [
  {
    key: 'JOKER',
    cards: [sample('JOKER', null)],
    label: 'Joker',
    points: 50,
    role: 'wild',
    blurb: 'Wild. Stands in for any rank inside a meld.',
  },
  {
    key: '2',
    cards: [sample('2', 'S'), sample('2', 'H')],
    label: 'Two',
    points: 20,
    role: 'wild',
    blurb: 'Wild. Stands in for any rank inside a meld.',
  },
  {
    key: 'A',
    cards: [sample('A', 'S')],
    label: 'Ace',
    points: 20,
    blurb: 'An ordinary card — the most valuable one you can meld normally.',
  },
  {
    key: 'K',
    cards: [sample('K', 'H'), sample('10', 'C')],
    label: 'King down to eight',
    points: 10,
    blurb: 'K, Q, J, 10, 9 and 8 all count the same.',
  },
  {
    key: '7',
    cards: [sample('7', 'D'), sample('4', 'S')],
    label: 'Seven down to four',
    points: 5,
    blurb: '7, 6, 5 and 4 all count the same.',
  },
  {
    key: '3red',
    cards: [sample('3', 'H')],
    label: 'Red three',
    points: 100,
    role: 'bonus',
    blurb: 'Never held. It leaves your hand the moment it arrives and waits beside your melds. Worth 100 each, or 800 for all four — but only if your side has melded. Caught without a meld down, the same figure counts against you.',
  },
  {
    key: '3black',
    cards: [sample('3', 'S')],
    label: 'Black three',
    points: 5,
    role: 'block',
    blurb: 'Discard one and the next player cannot take the pile on their turn. You can only meld black threes on the turn you go out.',
  },
];

function pointsFor(row, pointValues) {
  return pointValues?.[row.key] ?? row.points;
}

export function CardValueTable({ pointValues, compact }) {
  return (
    <ul className={`card-guide${compact ? ' card-guide--compact' : ''}`}>
      {CARD_ROWS.map((row) => (
        <li className="card-guide__row" key={row.key}>
          <span className="card-guide__cards">
            {row.cards.map((card) => (
              <Card key={card.id} card={card} size={compact ? 'tiny' : 'small'} static />
            ))}
          </span>
          <span className="card-guide__text">
            <span className="card-guide__head">
              <strong className="card-guide__label">{row.label}</strong>
              {row.role && <span className={`card-guide__role card-guide__role--${row.role}`}>{row.role}</span>}
              <span className="card-guide__points">{pointsFor(row, pointValues)} pts</span>
            </span>
            <span className="card-guide__blurb">{row.blurb}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Hold for the card guide ──────────────────────────────────────────────
   At the table the guide is a glance, not a screen you sit in: press and
   hold and it is up, let go and it is gone. No open state to forget about
   and no second click needed to get back to your hand.                   */

export function CardGuideHold({ game }) {
  const [held, setHeld] = useState(false);
  const hide = () => setHeld(false);

  return (
    <>
      <button
        type="button"
        className={`hold-btn${held ? ' is-held' : ''}`}
        aria-label="Hold to see card values"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setHeld(true);
        }}
        onPointerUp={hide}
        onPointerCancel={hide}
        onPointerLeave={hide}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setHeld(true);
          }
        }}
        onKeyUp={hide}
        onBlur={hide}
      >
        <span className="hold-btn__label">Cards</span>
        <span className="hold-btn__hint">hold</span>
      </button>

      {held && (
        <div className="cards-sheet" role="dialog" aria-label="Card values">
          <div className="cards-sheet__panel">
            <h2 className="cards-sheet__title">
              Card values<span className="cards-sheet__sub">what each one is worth, and what it does</span>
            </h2>

            <CardValueTable pointValues={game?.pointValues} compact />

            <ul className="cards-sheet__notes">
              <li>
                <strong>Melds</strong> are 3+ of a rank. Wilds must be outnumbered by real cards, and never more than
                three in one meld.
              </li>
              <li>
                <strong>Canasta</strong> is 7+ cards — 500 all-natural, 300 with wilds. Your side needs one before
                anyone on it can go out.
              </li>
              {game?.openingThreshold != null && (
                <li>
                  <strong>Your opening</strong> must be worth {game.openingThreshold} in one turn before your side can
                  meld at all.
                </li>
              )}
              <li>
                <strong>Ending a turn</strong> leaves you 2 cards or more, unless you are going out.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
