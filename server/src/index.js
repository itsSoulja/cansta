import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createRoom, joinRoom, getRoomBySocket, leaveRoom, startGame, isValidMode } from './rooms/roomManager.js';
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

function lobbyView(room) {
  return {
    code: room.code,
    mode: room.mode,
    packCount: room.packCount,
    hostSocketId: room.hostSocketId,
    seats: room.seats.map((s) => (s ? { socketId: s.socketId, name: s.name } : null)),
    started: Boolean(room.gameState),
  };
}

function broadcastLobby(room) {
  io.to(room.code).emit('lobby', lobbyView(room));
}

function broadcastState(room) {
  if (!room.gameState) return;
  for (const seat of room.seats) {
    if (!seat) continue;
    io.to(seat.socketId).emit('state', redactStateFor(room.gameState, seat.socketId));
  }
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ mode, packCount, name } = {}, cb = () => {}) => {
    if (!isValidMode(mode)) return cb({ ok: false, error: 'Invalid mode' });
    if (mode !== '1v1' && ![2, 3, 4].includes(packCount)) return cb({ ok: false, error: 'Invalid pack count' });
    const room = createRoom({ mode, packCount, hostSocketId: socket.id, hostName: name || 'Host' });
    socket.join(room.code);
    cb({ ok: true, code: room.code });
    broadcastLobby(room);
  });

  socket.on('join_room', ({ code, name } = {}, cb = () => {}) => {
    const result = joinRoom((code || '').toUpperCase(), socket.id, name || 'Player');
    if (!result.ok) return cb(result);
    socket.join(result.room.code);
    cb({ ok: true, code: result.room.code });
    broadcastLobby(result.room);
  });

  // Leaving is the deliberate counterpart of the disconnect path: the seat is
  // freed the same way, but the socket stays connected and lands back on the
  // landing page. Only before the game starts — once it has, seats are keyed
  // to socket ids and a vacated one would orphan a hand mid-match.
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
    const result = startGame(room.code, socket.id);
    if (!result.ok) return cb(result);
    cb({ ok: true });
    broadcastLobby(result.room);
    broadcastState(result.room);
  });

  socket.on('action', (action = {}, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.gameState) return cb({ ok: false, error: 'Game not started' });
    const result = applyAction(room.gameState, { ...action, playerId: socket.id });
    cb(result);
    if (result.ok) broadcastState(room);
  });

  socket.on('next_round', (_payload, cb = () => {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.gameState) return cb({ ok: false, error: 'Game not started' });
    if (room.hostSocketId !== socket.id) return cb({ ok: false, error: 'Only the host can start the next round' });
    const result = startNextRound(room.gameState);
    cb(result);
    if (result.ok) broadcastState(room);
  });

  socket.on('disconnect', () => {
    const result = leaveRoom(socket.id);
    if (!result || result.roomDeleted || !result.room) return;
    broadcastLobby(result.room);
  });
});

server.listen(PORT, () => {
  console.log(`Cansta server listening on :${PORT}`);
});
