import { createMatch } from '../game/state.js';

const rooms = new Map();
const socketToRoom = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0/I/1

// A room with nobody connected to it is kept this long before it is swept, so
// a refresh, a dropped phone or a server-side blip has plenty of room to come
// back to a game in progress. Rooms are in memory, so something has to.
const ABANDON_TTL_MS = 30 * 60 * 1000;

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Two ways to play, and neither asks you to commit to a number up front:
// people arrive, and the host deals when the table looks right. Free-for-all
// gives every seat its own side; teams pairs the seats alternately, which is
// why it wants an even table.
const MODES = {
  free: { min: 2, max: 5, even: false },
  teams: { min: 4, max: 6, even: true },
};

export function isValidMode(mode) {
  return Object.hasOwn(MODES, mode);
}

export function modeLimits(mode) {
  return MODES[mode];
}

// Everyone is dealt 14 cards, so the stock is what decides how many packs a
// table needs. Two packs leave a healthy stock up to four players; past that
// the round would be over before it started.
export function packsFor(playerCount) {
  return playerCount <= 4 ? 2 : 3;
}

// Whether the host may deal yet, as a sentence rather than a boolean, so the
// lobby can say what it is waiting for.
export function startBlocker(mode, playerCount) {
  const limits = MODES[mode];
  if (!limits) return 'Unknown mode';
  if (playerCount < limits.min) {
    const missing = limits.min - playerCount;
    return `Waiting for ${missing} more player${missing === 1 ? '' : 's'}`;
  }
  if (playerCount > limits.max) return `That is more than ${limits.max} players`;
  if (limits.even && playerCount % 2 !== 0) return 'Teams need even sides — one more player, or one fewer';
  return null;
}

// A seat's `playerId` is its identity for the whole match — the game state is
// keyed by it — while `socketId` is merely whichever connection is holding that
// seat right now. A seat with no socket is a player who walked out mid-hand;
// it keeps its cards and waits for someone to sit back down in it.
//
// `room.seats` holds only real seats, in the order people arrived. Before the
// game it grows and shrinks with them; once dealt, its length is fixed for the
// match, because the game state is keyed off exactly those ids.
function makeSeat({ playerId, socketId, name }) {
  return { playerId, socketId, name };
}

export function seatOf(room, socketId) {
  return room.seats.find((s) => s.socketId === socketId) ?? null;
}

export function playerIdOf(room, socketId) {
  return seatOf(room, socketId)?.playerId ?? null;
}

function bind(room, seat, socketId, name) {
  // Whatever socket held this seat before is done with it.
  if (seat.socketId) socketToRoom.delete(seat.socketId);
  seat.socketId = socketId;
  if (name) seat.name = name;
  socketToRoom.set(socketId, room.code);
  room.abandonedSince = null;
}

export function createRoom({ mode, playerId, socketId, name }) {
  const code = generateCode();
  const room = {
    code,
    mode,
    // Settled from the turnout when the game is dealt, not guessed at now.
    packCount: null,
    hostPlayerId: playerId,
    seats: [makeSeat({ playerId, socketId, name })],
    gameState: null,
    createdAt: Date.now(),
    abandonedSince: null,
  };
  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  return room;
}

function sameName(a, b) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

// One door for everybody: a first arrival, a player whose tab reloaded, and a
// stranger typing the code at a game already under way all come through here.
// Holding the playerId of a seat is what proves you are that player; failing
// that, an empty chair at a started table can simply be sat in.
export function joinRoom(code, { playerId, socketId, name }) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };

  const own = room.seats.find((s) => s.playerId === playerId);
  if (own) {
    if (own.socketId === socketId) return { ok: true, room, seat: own, resumed: true };
    bind(room, own, socketId, name);
    return { ok: true, room, seat: own, resumed: true };
  }

  if (!room.gameState) {
    if (room.seats.length >= MODES[room.mode].max) return { ok: false, error: 'Room is full' };
    const seat = makeSeat({ playerId, socketId, name });
    room.seats.push(seat);
    socketToRoom.set(socketId, code);
    room.abandonedSince = null;
    return { ok: true, room, seat };
  }

  // The game is running, so there is no new seat to hand out — only a chair
  // somebody left. Take over the hand that was dealt to it, keeping its
  // playerId: that is the name the game state knows the seat by.
  const vacant = room.seats.filter((s) => !s.socketId);
  if (vacant.length === 0) {
    return { ok: false, error: 'That game is under way and every seat is taken' };
  }
  const seat = vacant.find((s) => sameName(s.name, name)) ?? vacant[0];
  bind(room, seat, socketId, name);
  return { ok: true, room, seat, resumed: true };
}

export function getRoom(code) {
  return rooms.get(code);
}

export function getRoomBySocket(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

function dropRoomIfEmpty(room) {
  if (room.seats.length > 0) return false;
  rooms.delete(room.code);
  return true;
}

function reassignHost(room) {
  if (room.seats.some((s) => s.playerId === room.hostPlayerId)) return;
  room.hostPlayerId = room.seats[0]?.playerId ?? null;
}

// Leaving on purpose, from the lobby: the seat is given up for good and the
// table closes up around it.
export function leaveRoom(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  socketToRoom.delete(socketId);
  const idx = room.seats.findIndex((s) => s.socketId === socketId);
  if (idx !== -1) room.seats.splice(idx, 1);
  if (dropRoomIfEmpty(room)) return { code: room.code, room: null, roomDeleted: true };
  reassignHost(room);
  return { code: room.code, room, roomDeleted: false };
}

// Losing the connection. Before the game starts that is the same as leaving —
// nothing has been dealt, so the seat goes back in the pool. Once cards are
// out, the seat is held: only the socket is let go, and the hand sits there
// until that player (or anyone with the code) sits back down.
export function detachSocket(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  if (!room.gameState) return leaveRoom(socketId);

  socketToRoom.delete(socketId);
  const seat = seatOf(room, socketId);
  if (seat) seat.socketId = null;
  if (!room.seats.some((s) => s.socketId)) room.abandonedSince = Date.now();
  return { code: room.code, room, roomDeleted: false, seat };
}

export function startGame(code, requesterPlayerId) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };
  if (room.hostPlayerId !== requesterPlayerId) return { ok: false, error: 'Only the host can start the game' };
  if (room.gameState) return { ok: false, error: 'Game already started' };
  const blocked = startBlocker(room.mode, room.seats.length);
  if (blocked) return { ok: false, error: blocked };
  const playerIds = room.seats.map((s) => s.playerId);
  room.packCount = packsFor(playerIds.length);
  room.gameState = createMatch({ mode: room.mode, packCount: room.packCount, playerIds });
  return { ok: true, room };
}

export function playerName(room, playerId) {
  const seat = room.seats.find((s) => s.playerId === playerId);
  return seat ? seat.name : null;
}

// Nobody is coming back to these. Called on a timer from index.js, since an
// abandoned room would otherwise sit in memory for the life of the process.
export function sweepAbandonedRooms(now = Date.now()) {
  const dropped = [];
  for (const [code, room] of rooms) {
    if (!room.abandonedSince || now - room.abandonedSince < ABANDON_TTL_MS) continue;
    rooms.delete(code);
    dropped.push(code);
  }
  return dropped;
}
