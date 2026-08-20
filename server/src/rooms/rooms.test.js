import { describe, it, expect } from 'vitest';
import {
  createRoom,
  joinRoom,
  detachSocket,
  leaveRoom,
  startGame,
  getRoomBySocket,
  playerIdOf,
  sweepAbandonedRooms,
} from './roomManager.js';

// A two-seat table with the game already dealt, which is where every question
// about walking out and coming back actually arises.
let tables = 0;
function startedTable() {
  const n = tables++;
  const room = createRoom({ mode: '1v1', packCount: 2, playerId: `pid-a${n}`, socketId: `sock-a${n}`, name: 'Ana' });
  joinRoom(room.code, { playerId: `pid-b${n}`, socketId: `sock-b${n}`, name: 'Bo' });
  const started = startGame(room.code, `pid-a${n}`);
  expect(started.ok).toBe(true);
  return { room, a: { playerId: `pid-a${n}`, socketId: `sock-a${n}` }, b: { playerId: `pid-b${n}`, socketId: `sock-b${n}` } };
}

describe('seats across a disconnect', () => {
  it('gives the seat back to the player who reloads into it, hand and all', () => {
    const { room, a } = startedTable();
    const hand = room.gameState.hands[a.playerId];

    detachSocket(a.socketId);
    expect(room.seats[0]).not.toBeNull();
    expect(room.seats[0].socketId).toBeNull();
    expect(getRoomBySocket(a.socketId)).toBeNull();

    const back = joinRoom(room.code, { playerId: a.playerId, socketId: 'reloaded', name: 'Ana' });
    expect(back.ok).toBe(true);
    expect(back.resumed).toBe(true);
    expect(back.seat.playerId).toBe(a.playerId);
    expect(playerIdOf(room, 'reloaded')).toBe(a.playerId);
    // The game never noticed: the state is keyed by the seat, not the socket.
    expect(room.gameState.hands[a.playerId]).toBe(hand);
  });

  it('lets somebody else sit down in an abandoned chair, keeping its cards', () => {
    const { room, b } = startedTable();
    detachSocket(b.socketId);

    const taken = joinRoom(room.code, { playerId: 'stranger-1', socketId: 'stranger-sock-1', name: 'Cy' });
    expect(taken.ok).toBe(true);
    // The seat keeps the id the hand was dealt to; the newcomer inherits it.
    expect(taken.seat.playerId).toBe(b.playerId);
    expect(taken.seat.name).toBe('Cy');
    expect(playerIdOf(room, 'stranger-sock-1')).toBe(b.playerId);
  });

  it('turns nobody away from a table where every seat is still held', () => {
    const { room } = startedTable();
    const res = joinRoom(room.code, { playerId: 'stranger-2', socketId: 'stranger-sock-2', name: 'Cy' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/under way/i);
  });

  it('frees the seat outright when the game has not been dealt yet', () => {
    const room = createRoom({ mode: '1v1', packCount: 2, playerId: 'pid-x', socketId: 'sock-x', name: 'Xu' });
    joinRoom(room.code, { playerId: 'pid-y', socketId: 'sock-y', name: 'Yi' });
    detachSocket('sock-y');
    expect(room.seats[1]).toBeNull();
  });

  it('passes the host on when the host leaves the lobby, and keeps it when they only drop out', () => {
    const lobby = createRoom({ mode: '1v1', packCount: 2, playerId: 'pid-h', socketId: 'sock-h', name: 'Ho' });
    joinRoom(lobby.code, { playerId: 'pid-g', socketId: 'sock-g', name: 'Gu' });
    leaveRoom('sock-h');
    expect(lobby.hostPlayerId).toBe('pid-g');

    const { room, a } = startedTable();
    detachSocket(a.socketId);
    expect(room.hostPlayerId).toBe(a.playerId);
  });

  it('sweeps a table nobody came back to, and leaves the others alone', () => {
    const gone = startedTable();
    const busy = startedTable();
    detachSocket(gone.a.socketId);
    expect(gone.room.abandonedSince).toBeNull(); // one player is still there
    detachSocket(gone.b.socketId);
    expect(gone.room.abandonedSince).not.toBeNull();

    // Long enough ago that nobody is coming back.
    gone.room.abandonedSince = Date.now() - 60 * 60 * 1000;
    const dropped = sweepAbandonedRooms();
    expect(dropped).toContain(gone.room.code);
    expect(dropped).not.toContain(busy.room.code);
    expect(joinRoom(gone.room.code, { playerId: gone.a.playerId, socketId: 's', name: 'Ana' }).ok).toBe(false);
  });
});
