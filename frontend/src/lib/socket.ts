import { io } from "socket.io-client";

// autoConnect: false — the socket connects explicitly when the user
// calls joinRoom(). This prevents a dangling connection before any
// room has been joined and makes the reconnect flow easier to reason about.
export const socket = io("http://localhost:5000", {
  autoConnect: false,
});