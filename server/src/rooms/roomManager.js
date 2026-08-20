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

const SEATS_BY_MODE = { '1v1': 2, '1v1v1': 3, '1v1v1v1': 4, '2v2': 4 };

export function isValidMode(mode) {
  return Object.hasOwn(SEATS_BY_MODE, mode);
}

function seatCount(mode) {
  return SEATS_BY_MODE[mode];
}

// A seat's `playerId` is its identity for the whole match — the game state is
// keyed by it — while `socketId` is merely whichever connection is holding that
// seat right now. A seat with no socket is a player who walked out mid-hand;
// it keeps its cards and waits for someone to sit back down in it.
function makeSeat({ playerId, socketId, name }) {
  return { playerId, socketId, name };
}

export function seatOf(room, socketId) {
  return room.seats.find((s) => s && s.socketId === socketId) ?? null;
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

export function createRoom({ mode, packCount, playerId, socketId, name }) {
  const code = generateCode();
  // Heads-up always uses two packs; every larger table lets the host choose.
  const effectivePackCount = mode === '1v1' ? 2 : packCount;
  const room = {
    code,
    mode,
    packCount: effectivePackCount,
    hostPlayerId: playerId,
    seats: new Array(seatCount(mode)).fill(null),
    gameState: null,
    createdAt: Date.now(),
    abandonedSince: null,
  };
  room.seats[0] = makeSeat({ playerId, socketId, name });
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

  const own = room.seats.find((s) => s && s.playerId === playerId);
  if (own) {
    if (own.socketId === socketId) return { ok: true, room, seat: own, resumed: true };
    bind(room, own, socketId, name);
    return { ok: true, room, seat: own, resumed: true };
  }

  if (!room.gameState) {
    const emptyIdx = room.seats.findIndex((s) => s === null);
    if (emptyIdx === -1) return { ok: false, error: 'Room is full' };
    room.seats[emptyIdx] = makeSeat({ playerId, socketId, name });
    socketToRoom.set(socketId, code);
    room.abandonedSince = null;
    return { ok: true, room, seat: room.seats[emptyIdx] };
  }

  // The game is running, so there is no new seat to hand out — only a chair
  // somebody left. Take over the hand that was dealt to it, keeping its
  // playerId: that is the name the game state knows the seat by.
  const vacant = room.seats.filter((s) => s && !s.socketId);
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
  if (room.seats.some((s) => s !== null)) return false;
  rooms.delete(room.code);
  return true;
}

function reassignHost(room) {
  if (room.seats.some((s) => s && s.playerId === room.hostPlayerId)) return;
  const next = room.seats.find((s) => s !== null);
  room.hostPlayerId = next ? next.playerId : null;
}

// Leaving on purpose, from the lobby: the seat is given up for good.
export function leaveRoom(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  socketToRoom.delete(socketId);
  const idx = room.seats.findIndex((s) => s && s.socketId === socketId);
  if (idx !== -1) room.seats[idx] = null;
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
  if (!room.seats.some((s) => s && s.socketId)) room.abandonedSince = Date.now();
  return { code: room.code, room, roomDeleted: false, seat };
}

export function startGame(code, requesterPlayerId) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };
  if (room.hostPlayerId !== requesterPlayerId) return { ok: false, error: 'Only the host can start the game' };
  if (room.seats.some((s) => s === null)) return { ok: false, error: 'Waiting for all seats to fill' };
  if (room.gameState) return { ok: false, error: 'Game already started' };
  const playerIds = room.seats.map((s) => s.playerId);
  room.gameState = createMatch({ mode: room.mode, packCount: room.packCount, playerIds });
  return { ok: true, room };
}

export function playerName(room, playerId) {
  const seat = room.seats.find((s) => s && s.playerId === playerId);
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
