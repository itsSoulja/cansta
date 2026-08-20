import { useEffect, useState } from 'react';

// The code stays on screen for the whole game, not just the lobby: it is the
// way back to a seat somebody has walked away from, so it has to be readable
// mid-hand by whoever is still at the table.
export function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!code) return null;

  const copy = () => {
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => {},
    );
  };

  return (
    <button type="button" className="code-chip" onClick={copy} title="Copy the table code">
      <span className="code-chip__label">table</span>
      <span className="code-chip__code">{code}</span>
      <span className={`code-chip__hint${copied ? ' is-copied' : ''}`}>{copied ? 'copied' : 'copy'}</span>
    </button>
  );
}
