// Who this tab is, across reloads.
//
// The id lives in sessionStorage rather than localStorage on purpose: it is
// per-tab, so two tabs of the same browser are two players (which is how the
// game gets tested), but it survives a refresh, which is the whole point. Close
// the tab and the id is gone — that is what the "join with the code" path at a
// started table is for.
const ID_KEY = 'cansta:playerId';
const ROOM_KEY = 'cansta:room';

function read(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null; // private mode, storage disabled — the game still plays, just without resume
  }
}

function write(key, value) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function playerId() {
  const existing = read(ID_KEY);
  if (existing) return existing;
  const minted = crypto.randomUUID?.() ?? `p${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  write(ID_KEY, minted);
  return minted;
}

// The server has the last word on which id a seat carries — sitting down in
// somebody else's abandoned chair means inheriting the id it was dealt to.
export function adoptPlayerId(id) {
  if (id) write(ID_KEY, id);
}

export function rememberRoom({ code, name }) {
  write(ROOM_KEY, JSON.stringify({ code, name }));
}

export function forgetRoom() {
  write(ROOM_KEY, null);
}

export function rememberedRoom() {
  const raw = read(ROOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.code ? parsed : null;
  } catch {
    return null;
  }
}
