// Names are typed by people, so they arrive with stray spaces, odd capitals and
// the occasional slip of a finger. Matching ignores everything that is not a
// letter or a digit, then allows a few wrong characters — more for a long name
// than a short one, and none at all for a very short one, where a typo's worth
// of distance would swallow unrelated names.
export function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function editDistance(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

export function toleranceFor(length) {
  if (length <= 3) return 0;
  return Math.min(3, Math.max(1, Math.floor(length / 4)));
}

// The closest of `names` to `query`, or null when nothing is near enough.
export function matchName(query, names) {
  const q = normalizeName(query);
  if (!q) return null;

  let best = null;
  for (const name of names) {
    const candidate = normalizeName(name);
    if (!candidate) continue;
    const distance = editDistance(q, candidate);
    if (distance > toleranceFor(Math.max(q.length, candidate.length))) continue;
    if (!best || distance < best.distance) best = { name, distance };
  }
  return best ? best.name : null;
}
