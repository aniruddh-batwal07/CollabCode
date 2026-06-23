import { io } from "socket.io-client";

// autoConnect: false — the socket connects explicitly when the user
// calls joinRoom(). This prevents a dangling connection before any
// room has been joined and makes the reconnect flow easier to reason about.
export const socket = io(
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000",
  { autoConnect: false }
);