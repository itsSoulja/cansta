import { useState } from 'react';

export function Landing({ onCreate, onJoin, error }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('1v1');
  const [packCount, setPackCount] = useState(2);
  const [joinCode, setJoinCode] = useState('');

  return (
    <div style={{ maxWidth: 420, margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>Cansta</h1>
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <label style={{ display: 'block', marginBottom: 12 }}>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%' }} />
      </label>

      <fieldset style={{ marginBottom: 16 }}>
        <legend>Create a game</legend>
        <label>
          <input type="radio" checked={mode === '1v1'} onChange={() => setMode('1v1')} /> 1v1
        </label>{' '}
        <label>
          <input type="radio" checked={mode === '2v2'} onChange={() => setMode('2v2')} /> 2v2
        </label>
        {mode === '2v2' && (
          <div style={{ marginTop: 8 }}>
            Packs of cards:{' '}
            <select value={packCount} onChange={(e) => setPackCount(Number(e.target.value))}>
              <option value={2}>2 (standard)</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        )}
        <button
          style={{ marginTop: 12 }}
          disabled={!name.trim()}
          onClick={() => onCreate({ mode, packCount, name: name.trim() })}
        >
          Create Game
        </button>
      </fieldset>

      <fieldset>
        <legend>Join a game</legend>
        <input
          placeholder="Room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button
          disabled={!name.trim() || !joinCode.trim()}
          onClick={() => onJoin({ code: joinCode.trim(), name: name.trim() })}
        >
          Join Game
        </button>
      </fieldset>
    </div>
  );
}
