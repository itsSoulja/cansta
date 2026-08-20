import { useEffect } from 'react';
import { CardValueTable } from './CardGuide.jsx';

/* The whole game, explained. Opened from the landing screen; the table shows
   a much shorter version instead. Everything here describes what the engine
   in `server/src/game/` does — see RULES.md for the same account written
   against the code. */

function Section({ title, children }) {
  return (
    <section className="rules-book__section">
      <h3 className="rules-book__heading">{title}</h3>
      {children}
    </section>
  );
}

export function RulesBook({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-book" role="dialog" aria-label="How to play Cansta" onClick={(e) => e.stopPropagation()}>
        <header className="rules-book__top">
          <h2 className="rules-book__title">How to play</h2>
          <button type="button" className="rules-book__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="rules-book__body">
          <p className="rules-book__lede">
            Canasta is a melding game. You collect cards of the same rank, lay them down in sets, and race to
            build a <strong>canasta</strong> — seven of a kind — before anyone else. First side to
            <strong> 5000 points</strong> takes the match.
          </p>

          <Section title="Who is playing">
            <p>
              Two ways to play, and no head-count to settle first. A{' '}
              <strong>free-for-all</strong> seats <strong>two to five</strong>, everyone for themselves.{' '}
              <strong>Teams</strong> takes <strong>four or six</strong> and splits the table alternately into two
              sides, so your partners always sit away from you.
            </p>
            <p className="rules-book__note">
              Open a table, share the code, and deal whenever everyone is sat down. How many packs of cards are in play
              follows from the turnout — two up to four players, three beyond that.
            </p>
          </Section>

          <Section title="A turn, start to finish">
            <ol className="rules-book__steps">
              <li>
                <strong>Draw.</strong> Take the top card of the stock, or take the whole discard pile if you are
                allowed to.
              </li>
              <li>
                <strong>Meld.</strong> Lay down any sets you like, or none at all. Add to sets your side already has.
              </li>
              <li>
                <strong>Discard.</strong> One card onto the pile. This is what ends your turn — there is no other way
                to pass play on.
              </li>
            </ol>
          </Section>

          <Section title="The cards">
            <CardValueTable />
            <p className="rules-book__note">
              Those points count twice over: they are what a meld is worth on the table, and what a card costs you if
              you are still holding it when the round ends.
            </p>
          </Section>

          <Section title="Melds">
            <ul className="rules-book__list">
              <li>A meld is <strong>three or more cards of the same rank</strong>. Suits never matter.</li>
              <li>
                Wilds — <strong>2s and jokers</strong> — can stand in for the rank, but a meld must be built on real
                cards: <strong>wilds have to be outnumbered by naturals</strong>.
              </li>
              <li>
                <strong>Never more than three wilds</strong> in one meld, however long it grows.
              </li>
              <li>
                Your side keeps <strong>one meld per rank</strong>. New cards of a rank you already have join the set
                you already laid down.
              </li>
              <li>
                <strong>A canasta is seven cards or more.</strong> All naturals is worth <strong>500</strong>; one
                with wilds in it is worth <strong>300</strong>.
              </li>
            </ul>
          </Section>

          <Section title="Getting started — the opening meld">
            <p>
              Your side cannot meld anything until its first lay-down clears a points threshold, and that threshold
              climbs as you win:
            </p>
            <table className="rules-book__table">
              <tbody>
                <tr><td>below zero</td><td><strong>15</strong></td></tr>
                <tr><td>0 – 1499</td><td><strong>50</strong></td></tr>
                <tr><td>1500 – 2999</td><td><strong>90</strong></td></tr>
                <tr><td>3000 and up</td><td><strong>120</strong></td></tr>
              </tbody>
            </table>
            <p className="rules-book__note">
              Everything you put down on that one turn counts toward the total together — which is why the table lets
              you stage several sets before laying them all at once. Black threes can never be part of an opening. If your
              side has been driven below zero, the bar drops to 15 so you can get back on the table.
            </p>
          </Section>

          <Section title="Taking the discard pile">
            <p>
              Instead of drawing, you can take the <em>whole</em> pile — but you must meld its top card straight away,
              with cards from your hand. Everything buried underneath goes into your hand.
            </p>
            <p>
              <strong>Before your side has melded</strong>, the top card has to be matched by a{' '}
              <strong>natural pair</strong> — two cards of that rank out of your own hand. One card and a wild will not
              buy the pile. Once your side has something on the table, one and a wild is enough.
            </p>
            <p className="rules-book__note">The pile is closed to you when:</p>
            <ul className="rules-book__list">
              <li>the top card is a <strong>wild</strong> or <strong>any three</strong>;</li>
              <li>your side <strong>already melds that rank</strong>;</li>
              <li>the player before you discarded a <strong>black three</strong>;</li>
              <li>you hold <strong>two cards or fewer</strong> — the pile costs you cards before it pays out;</li>
              <li>you have already drawn this turn.</li>
            </ul>
            <p className="rules-book__note">
              The table always tells you which of these is stopping you, so you never have to guess.
            </p>
          </Section>

          <Section title="Going out">
            <ul className="rules-book__list">
              <li>
                You must <strong>end every turn holding at least two cards</strong> — unless that turn is the one that
                ends the round.
              </li>
              <li>
                To go out your side needs a <strong>completed canasta</strong>. With one, you can play down to a single
                card and discard it, or clear your hand entirely.
              </li>
              <li>Going out first is worth <strong>+100</strong>.</li>
              <li>
                Doing it in one turn, with your side having melded <em>nothing</em> beforehand, is a{' '}
                <strong>concealed go-out — +500</strong>.
              </li>
              <li>If the stock runs dry first, the round just ends and nobody collects for going out.</li>
            </ul>
          </Section>

          <Section title="Scoring a round">
            <ul className="rules-book__list">
              <li><strong>Add</strong> the value of every card in your melds.</li>
              <li><strong>Add</strong> 500 for each natural canasta, 300 for each mixed one.</li>
              <li><strong>Add</strong> your red threes — or subtract them, if your side never melded.</li>
              <li><strong>Add</strong> 100 for going out, and 500 more if it was concealed.</li>
              <li><strong>Subtract</strong> every card still in hand — everyone on your side, not just you.</li>
            </ul>
          </Section>

          <Section title="House rules">
            <p className="rules-book__note">Cansta plays a little looser than tournament Canasta:</p>
            <ul className="rules-book__list">
              <li>You cannot take the pile onto a rank you already meld — the top card always starts a fresh set.</li>
              <li>Only the top card gets melded on a pickup; the rest of the pile simply goes to your hand.</li>
              <li>Black threes block the next player only. There is no frozen pile.</li>
              <li>Taking the pile can be your opening play, if what you lay down clears the threshold.</li>
              <li>Your first pickup of the round costs a natural pair; after your side has melded, one and a wild does it.</li>
              <li>In team mode you do not need your partners' permission to go out.</li>
            </ul>
          </Section>

          <Section title="If you drop out">
            <p>
              Reloading the page does not cost you your seat: the tab remembers who you are and walks straight back to
              your cards. Close the tab and the seat still waits — it keeps the hand it was dealt, and the table shows
              the code all game. Type that code in on the landing screen and you sit back down where you were.
            </p>
            <p className="rules-book__note">
              Nobody can play a hand for an absent player, so the table simply waits on them. A table with nobody at it
              is cleared after half an hour.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
