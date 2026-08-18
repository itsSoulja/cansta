import { createMatch } from '../game/state.js';

const rooms = new Map();
const socketToRoom = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0/I/1

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function seatCount(mode) {
  return mode === '2v2' ? 4 : 2;
}

export function createRoom({ mode, packCount, hostSocketId, hostName }) {
  const code = generateCode();
  const effectivePackCount = mode === '1v1' ? 2 : packCount;
  const room = {
    code,
    mode,
    packCount: effectivePackCount,
    hostSocketId,
    seats: new Array(seatCount(mode)).fill(null),
    gameState: null,
    createdAt: Date.now(),
  };
  room.seats[0] = { socketId: hostSocketId, name: hostName };
  rooms.set(code, room);
  socketToRoom.set(hostSocketId, code);
  return room;
}

export function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };
  if (room.gameState) return { ok: false, error: 'Game already started' };
  const emptyIdx = room.seats.findIndex((s) => s === null);
  if (emptyIdx === -1) return { ok: false, error: 'Room is full' };
  room.seats[emptyIdx] = { socketId, name };
  socketToRoom.set(socketId, code);
  return { ok: true, room };
}

export function getRoom(code) {
  return rooms.get(code);
}

export function getRoomBySocket(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

export function leaveRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  socketToRoom.delete(socketId);
  const idx = room.seats.findIndex((s) => s && s.socketId === socketId);
  if (idx !== -1) room.seats[idx] = null;

  const stillOccupied = room.seats.some((s) => s !== null);
  if (!stillOccupied) {
    rooms.delete(code);
    return { code, room: null, roomDeleted: true };
  }
  if (room.hostSocketId === socketId) {
    const nextHost = room.seats.find((s) => s !== null);
    room.hostSocketId = nextHost ? nextHost.socketId : null;
  }
  return { code, room, roomDeleted: false };
}

export function startGame(code, requesterSocketId) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: 'Room not found' };
  if (room.hostSocketId !== requesterSocketId) return { ok: false, error: 'Only the host can start the game' };
  if (room.seats.some((s) => s === null)) return { ok: false, error: 'Waiting for all seats to fill' };
  if (room.gameState) return { ok: false, error: 'Game already started' };
  const playerIds = room.seats.map((s) => s.socketId);
  room.gameState = createMatch({ mode: room.mode, packCount: room.packCount, playerIds });
  return { ok: true, room };
}

export function playerName(room, socketId) {
  const seat = room.seats.find((s) => s && s.socketId === socketId);
  return seat ? seat.name : null;
}
