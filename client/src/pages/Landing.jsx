import { useState } from 'react';
import { RulesBook } from '../components/RulesBook.jsx';

// Two ways to play, and no head-count to commit to: people take seats and the
// host deals when the table looks right.
const MODES = [
  { id: 'free', label: 'Free-for-all', blurb: 'Every player for themselves', seats: '2–5 players' },
  { id: 'teams', label: 'Teams', blurb: 'Partners, sat opposite', seats: '4 or 6 players' },
];

export function Landing({ onCreate, onJoin, onNameChange, error }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('free');
  const [joinCode, setJoinCode] = useState('');
  const [showRules, setShowRules] = useState(false);

  const named = name.trim().length > 0;

  return (
    <div className="portal">
      <div className="portal__glow" />
      <div className="portal__inner">
        <button type="button" className="portal__help" onClick={() => setShowRules(true)}>
          <span className="portal__help-mark" aria-hidden="true">?</span>
          How to play
        </button>
        <h1 className="portal__title">Cansta</h1>
        <p className="portal__sub">Canasta, dealt fast and played with friends.</p>

        {error && <p className="portal__error">{error}</p>}

        <label className="field">
          <span className="field__label">Your name</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onNameChange?.(e.target.value);
            }}
            placeholder="who's playing?"
          />
        </label>

        <section className="panel">
          <h2 className="panel__title">Start a table</h2>
          <div className="mode-grid mode-grid--pair">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-card${mode === m.id ? ' is-active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="mode-card__label">{m.label}</span>
                <span className="mode-card__blurb">{m.blurb}</span>
                <span className="mode-card__seats">{m.seats}</span>
              </button>
            ))}
          </div>

          <p className="panel__hint">
            Nobody has to say how many are playing. Open the table, share the code, and deal when everyone is sat down.
          </p>

          <button className="btn btn--primary btn--wide" disabled={!named} onClick={() => onCreate({ mode, name: name.trim() })}>
            Open a table
          </button>
        </section>

        <section className="panel">
          <h2 className="panel__title">Join a table</h2>
          <div className="join-row">
            <input
              className="field__input field__input--code"
              placeholder="CODE"
              maxLength={5}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button className="btn" disabled={!named || !joinCode.trim()} onClick={() => onJoin({ code: joinCode.trim(), name: name.trim() })}>
              Join
            </button>
          </div>
          <p className="panel__hint">
            The same code takes you back to a game you dropped out of — type it in and you're back in your seat with
            your cards.
          </p>
        </section>
      </div>

      {showRules && <RulesBook onClose={() => setShowRules(false)} />}
    </div>
  );
}
