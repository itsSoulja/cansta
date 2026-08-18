import { useCallback, useEffect, useState } from 'react';
import { socket } from '../socket.js';

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [myId, setMyId] = useState(socket.id ?? null);
  const [lobby, setLobby] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setMyId(socket.id);
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

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lobby', onLobby);
      socket.off('state', onState);
    };
  }, []);

  const createRoom = useCallback(({ mode, packCount, name }) => {
    setError(null);
    socket.emit('create_room', { mode, packCount, name }, (res) => {
      if (!res.ok) setError(res.error);
    });
  }, []);

  const joinRoom = useCallback(({ code, name }) => {
    setError(null);
    socket.emit('join_room', { code, name }, (res) => {
      if (!res.ok) setError(res.error);
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

  return { connected, myId, lobby, game, error, setError, createRoom, joinRoom, startGame, sendAction, nextRound };
}
