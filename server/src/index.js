import express from 'express';
import http from 'http';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import {
  createRoom,
  joinRoom,
  getRoomBySocket,
  leaveRoom,
  detachSocket,
  startGame,
  isValidMode,
  playerIdOf,
  sweepAbandonedRooms,
} from './rooms/roomManager.js';
import { redactStateFor } from './rooms/redact.js';
import { applyAction, startNextRound } from './game/engine.js';
import { lookupEasterEgg, easterEggFile } from './eggs/library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '../../client/dist');
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.get('/health', (req, res) => res.json({ ok: true }));

// The client is served from another origin in the split deploy (Cloudflare
// Pages talking to Render), so these routes have to say they may be read
// cross-origin. socket.io sets its own CORS and does not cover plain routes.
app.use('/easter-egg', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// Easter eggs. The pictures are never part of the client bundle and there is
// no endpoint that lists them: you ask with a name, and only a name close
// enough to one of the files comes back with the digest that fetches it.
app.get('/easter-egg', (req, res) => {
  const match = lookupEasterEgg(req.query.name);
  if (!match) return res.json({ found: false });
  res.json({ found: true, url: `/easter-egg/${match.token}` });
});

app.get('/easter-egg/:token', (req, res) => {
  const file = easterEggFile(req.params.token);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.sendFile(file, { headers: { 'Cache-Control': 'public, max-age=86400' } });
});

// Only present when the client is built alongside the server (e.g. the
// single-host tunnel setup). In the split Render + Cloudflare Pages
// deployment, the client is served separately and this directory won't exist.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// Seats are named to the client by their stable playerId, never by the socket
// holding them: the socket changes on every reload, the playerId does not.
// `connected` is what lets the table say who has stepped away from it.
function lobbyView(room) {
  return {
    code: room.code,
    mode: room.mode,
    packCount: room.packCount,
    hostPlayerId: room.hostPlayerId,
    seats: room.seats.map((s) => (s ? { playerId: s.playerId, name: s.name, connected: Boolean(s.socketId) } : null)),
    started: Boolean(room.gameState),
  };
}

function broadcastLobby(room) {
  io.to(room.code).emit('lobby', lobbyView(room));
}

function broadcastState(room) {
  if (!room.gameState) return;
  for (const seat of room.seats) {
    if (!seat || !seat.socketId) continue;
    io.to(seat.socketId).emit('state', redactStateFor(room.gameState, seat.playerId));
  }
}

// What a player gets on sitting down at a game already in progress. The events
// are dropped: they describe the move that happened before this socket existed,
// and replaying them would animate cards that are already where they belong.
function sendResumeState(socket, room, playerId) {
  if (!room.gameState) return;
  socket.emit('state', { ...redactStateFor(room.gameState, playerId), events: [] });
}

// The client mints a durable id and keeps it in localStorage, so a reload
// arrives claiming the same seat it left. Anything unusable is replaced with a
// server-side one, which the ack hands back for the client to store.
function normalizeId(raw) {
  return typeof raw === 'string' && raw.length >= 8 && raw.length <= 64 ? raw : randomUUID();
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ mode, packCount, name, playerId } = {}, cb = () => {}) => {
    if (!isValidMode(mode)) return cb({ ok: false, error: 'Invalid mode' });
    if (mode !== '1v1' && ![2, 3, 4].includes(packCount)) return cb({ ok: false, error: 'Invalid pack count' });
    const id = normalizeId(playerId);
    const room = createRoom({ mode, packCount, playerId: id, socketId: socket.id, name: name || 'Host' });
    socket.join(room.code);
    cb({ ok: true, code: room.code, playerId: id });
    broadcastLobby(room);
  });

  // Also the way back in. Holding a seat's playerId resumes that seat, mid-hand
  // or not; without one, a started game still has room for you if somebody has
  // left a chair empty. Either way the ack returns the seat's playerId, which
  // is the id the game state knows you by from then on.
  socket.on('join_room', ({ code, name, playerId } = {}, cb = () => {}) => {
    const result = joinRoom((code || '').toUpperCase(), {
      playerId: normalizeId(playerId),
      socketId: socket.id,
      name: name || 'Player',
    });
    if (!result.ok) return cb(result);
    socket.join(result.room.code);
    cb({ ok: true, code: result.room.code, playerId: result.seat.playerId, resumed: Boolean(result.resumed) });
    broadcastLobby(result.room);
    sendResumeState(socket, result.room, result.seat.playerId);
  });

  // Leaving is the deliberate counterpart of the disconnect path: the seat is
  // freed the same way, but the socket stays connected and lands back on the
  // landing page. Only before the game starts — once it has, the seat holds a
  // hand, and dropping it would orphan those cards for the rest of the match.
  socket.on('leave_room', (_payload, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return cb({ ok: false, error: 'Not in a room' });
    if (room.gameState) return cb({ ok: false, error: 'The game has already started' });
    const { code } = room;
    const result = leaveRoom(socket.id);
    socket.leave(code);
    cb({ ok: true });
    if (result && !result.roomDeleted && result.room) broadcastLobby(result.room);
  });

  socket.on('start_game', (_payload, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return cb({ ok: false, error: 'Not in a room' });
    const result = startGame(room.code, playerIdOf(room, socket.id));
    if (!result.ok) return cb(result);
    cb({ ok: true });
    broadcastLobby(result.room);
    broadcastState(result.room);
  });

  socket.on('action', (action = {}, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.gameState) return cb({ ok: false, error: 'Game not started' });
    const playerId = playerIdOf(room, socket.id);
    if (!playerId) return cb({ ok: false, error: 'You are not seated at this table' });
    const result = applyAction(room.gameState, { ...action, playerId });
    cb(result);
    if (result.ok) broadcastState(room);
  });

  // Normally the host deals the next round. If the host is the one who walked
  // out, whoever is still at the table may deal instead, so a missing player
  // cannot strand the match between rounds.
  socket.on('next_round', (_payload, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.gameState) return cb({ ok: false, error: 'Game not started' });
    const playerId = playerIdOf(room, socket.id);
    const hostSeat = room.seats.find((s) => s && s.playerId === room.hostPlayerId);
    const hostHere = Boolean(hostSeat?.socketId);
    if (hostHere && room.hostPlayerId !== playerId) {
      return cb({ ok: false, error: 'Only the host can start the next round' });
    }
    const result = startNextRound(room.gameState);
    cb(result);
    if (result.ok) broadcastState(room);
  });

  socket.on('disconnect', () => {
    const result = detachSocket(socket.id);
    if (!result || result.roomDeleted || !result.room) return;
    broadcastLobby(result.room);
  });
});

// Rooms live in memory, so an abandoned one has to be cleared out by hand.
setInterval(() => sweepAbandonedRooms(), 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Cansta server listening on :${PORT}`);
});
