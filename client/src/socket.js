import { io } from 'socket.io-client';

// In dev, client (5173) and server (3001) are different origins.
// In a production build the server serves the client itself, so
// connecting with no URL makes socket.io-client use the page's own origin.
const URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export const socket = io(URL, { autoConnect: true });
