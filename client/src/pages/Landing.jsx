import { useState } from 'react';

const MODES = [
  { id: '1v1', label: '1v1', blurb: 'Head to head', seats: 2 },
  { id: '1v1v1', label: '1v1v1', blurb: 'Three-way free-for-all', seats: 3 },
  { id: '1v1v1v1', label: '1v1v1v1', blurb: 'Four-way free-for-all', seats: 4 },
  { id: '2v2', label: '2v2', blurb: 'Partners, across the table', seats: 4 },
];

export function Landing({ onCreate, onJoin, onNameChange, error }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('1v1');
  const [packCount, setPackCount] = useState(2);
  const [joinCode, setJoinCode] = useState('');

  const named = name.trim().length > 0;

  return (
    <div className="portal">
      <div className="portal__glow" />
      <div className="portal__inner">
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
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-card${mode === m.id ? ' is-active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="mode-card__label">{m.label}</span>
                <span className="mode-card__blurb">{m.blurb}</span>
                <span className="mode-card__seats">{m.seats} players</span>
              </button>
            ))}
          </div>

          {mode !== '1v1' && (
            <label className="field field--inline">
              <span className="field__label">Packs of cards</span>
              <select className="field__input" value={packCount} onChange={(e) => setPackCount(Number(e.target.value))}>
                <option value={2}>2 — standard</option>
                <option value={3}>3 — longer round</option>
                <option value={4}>4 — marathon</option>
              </select>
            </label>
          )}

          <button className="btn btn--primary btn--wide" disabled={!named} onClick={() => onCreate({ mode, packCount, name: name.trim() })}>
            Deal me in
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
        </section>
      </div>
    </div>
  );
}
