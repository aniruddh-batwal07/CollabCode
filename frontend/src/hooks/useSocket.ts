import { useEffect } from "react";
import { socket } from "@/lib/socket";

/**
 * Subscribes to a socket event for the lifetime of the component.
 *
 * CONTRACT: `callback` MUST be referentially stable — wrap it in
 * `useCallback` at the call site. An unstable (inline) callback
 * causes the listener to be torn down and re-registered on every
 * render, creating windows where incoming events are silently dropped.
 */
export function useSocket(
  event: string,
  callback: (...args: any[]) => void
) {
  useEffect(() => {
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, [event, callback]);
}