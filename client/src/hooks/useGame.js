import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { adoptPlayerId, forgetRoom, playerId, rememberRoom, rememberedRoom } from '../session.js';

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [myId, setMyId] = useState(playerId);
  const [lobby, setLobby] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  // A tab that remembers a table shouldn't flash the landing page on its way
  // back to it: hold the boot screen until the rejoin has been answered.
  const [restoring, setRestoring] = useState(() => Boolean(rememberedRoom()));

  // Read inside the connect handler, which is registered once and must always
  // see the table this tab is actually sitting at.
  const seatRef = useRef(rememberedRoom());

  const seat = useCallback((code, name, id) => {
    adoptPlayerId(id);
    if (id) setMyId(id);
    seatRef.current = { code, name };
    rememberRoom({ code, name });
  }, []);

  useEffect(() => {
    // Every connection is a chance to sit back down: the first one after a
    // reload, and every silent reconnect socket.io makes after that. The seat
    // is held server-side, so re-announcing ourselves is all it takes.
    function resume() {
      const remembered = seatRef.current;
      if (!remembered) return setRestoring(false);
      socket.emit('join_room', { ...remembered, playerId: playerId() }, (res) => {
        setRestoring(false);
        if (res?.ok) return seat(res.code, remembered.name, res.playerId);
        // The table is gone (or full again). Start over rather than sit on a
        // dead code — but say why, since the player did not ask to leave.
        seatRef.current = null;
        forgetRoom();
        setLobby(null);
        setGame(null);
        setError(res?.error ?? 'That table is no longer there');
      });
    }

    function onConnect() {
      setConnected(true);
      resume();
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onLobby(payload) {
      setLobby(payload);
    }
    function onState(payload) {
      setGame(payload);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lobby', onLobby);
    socket.on('state', onState);
    // The socket connects as soon as the module loads, which can beat React to
    // registering the handler above. Catch up rather than wait for an event
    // that has already been and gone.
    if (socket.connected) {
      setConnected(true);
      resume();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lobby', onLobby);
      socket.off('state', onState);
    };
  }, [seat]);

  const createRoom = useCallback(
    ({ mode, name }) => {
      setError(null);
      socket.emit('create_room', { mode, name, playerId: playerId() }, (res) => {
        if (!res.ok) return setError(res.error);
        seat(res.code, name, res.playerId);
      });
    },
    [seat],
  );

  const joinRoom = useCallback(
    ({ code, name }) => {
      setError(null);
      socket.emit('join_room', { code, name, playerId: playerId() }, (res) => {
        if (!res.ok) return setError(res.error);
        seat(res.code, name, res.playerId);
      });
    },
    [seat],
  );

  const leaveRoom = useCallback(() => {
    setError(null);
    socket.emit('leave_room', {}, (res) => {
      if (!res.ok) return setError(res.error);
      seatRef.current = null;
      forgetRoom();
      setLobby(null);
      setGame(null);
    });
  }, []);

  const startGame = useCallback(() => {
    setError(null);
    socket.emit('start_game', {}, (res) => {
      if (!res.ok) setError(res.error);
    });
  }, []);

  const sendAction = useCallback((action, onResult) => {
    setError(null);
    socket.emit('action', action, (res) => {
      if (!res.ok) setError(res.error);
      if (onResult) onResult(res);
    });
  }, []);

  const nextRound = useCallback(() => {
    setError(null);
    socket.emit('next_round', {}, (res) => {
      if (!res.ok) setError(res.error);
    });
  }, []);

  return {
    connected,
    restoring,
    myId,
    lobby,
    game,
    error,
    setError,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    sendAction,
    nextRound,
  };
}
