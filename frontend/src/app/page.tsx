"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/collaboration";

import RoomControls from "@/components/RoomControls";
import CodeEditor from "@/components/CodeEditor";

import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const [roomId, setRoomId] = useState("room-1");
  const [users, setUsers] = useState<string[]>([]);

  // Keep the latest joined roomId available to the reconnect handler
  // without needing it in any dependency array.
  const activeRoomRef = useRef<string | null>(null);

  // Store the MonacoBinding so we can call .destroy() on cleanup,
  // preventing duplicate bindings from accumulating on re-mounts.
  const bindingRef = useRef<{ destroy(): void } | null>(null);

  // ── Reconnection handler ─────────────────────────────────────────
  // When the socket reconnects (e.g. after a network interruption),
  // the server-side socket.data is gone. Re-emit join-room so the
  // server re-adds this client to the room and presence list.
  useEffect(() => {
    const handleConnect = () => {
      if (activeRoomRef.current) {
        socket.emit("join-room", activeRoomRef.current);
      }
    };
    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, []); // socket is a module singleton — stable reference.

  // ── Yjs → Socket (local updates only) ───────────────────────────
  // THE KEY FIX: Y.applyUpdate() below passes `socket` as the origin.
  // Here we check that origin — if it equals `socket` the update came
  // from the network, so we skip re-emitting it to avoid an infinite
  // feedback loop:
  //   remote update → applyUpdate → ydoc fires "update" →
  //   socket.emit → backend relays → back to us → loop ✗
  useEffect(() => {
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === socket) return; // Network update — do not re-emit.

      socket.emit("yjs-update", {
        roomId: activeRoomRef.current,
        update: Array.from(update),
      });
    };

    ydoc.on("update", updateHandler);
    return () => {
      ydoc.off("update", updateHandler);
    };
  }, []); // ydoc and socket are module-level singletons — always stable.

  // ── Socket → Yjs ────────────────────────────────────────────────
  // Wrapped in useCallback so useSocket's useEffect dependency is
  // stable and the listener is NOT torn down/re-added on every render.
  const handleYjsUpdate = useCallback((update: number[]) => {
    

    Y.applyUpdate(
      ydoc,
      new Uint8Array(update),
      socket
    );

    
  }, []); 

  const handlePresenceUpdate = useCallback((updatedUsers: string[]) => {
    setUsers(updatedUsers);
  }, []);

  useSocket("yjs-update", handleYjsUpdate);
  useSocket(
    "document-sync",
    (update: number[]) => {
      Y.applyUpdate(
        ydoc,
        new Uint8Array(update),
        socket
      );
    }
  );
  useSocket("presence-update", handlePresenceUpdate);

  // ── Join room ────────────────────────────────────────────────────
  const joinRoom = () => {
    activeRoomRef.current = roomId;

    // Connect the socket on first join (autoConnect: false in socket.ts).
    // On subsequent joins (room switch), the socket is already connected.
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-room", roomId);
  };

  // ── MonacoBinding lifecycle ──────────────────────────────────────
  // If the editor ever remounts (Strict Mode double-invoke, HMR),
  // destroy the previous binding before creating a new one.
  // Without this, two bindings share one Y.Text and every keystroke
  // inserts the character twice.
  const handleEditorMount = async (editor: any, _monaco: any) => {
    const model = editor.getModel();
    if (!model) return;

    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const { MonacoBinding } = await import("y-monaco");

    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      null
    );

    bindingRef.current = binding;
  };

  // Destroy the binding when the component fully unmounts.
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, []);

  return (
    <main className="h-screen flex flex-col">
      <RoomControls
        roomId={roomId}
        setRoomId={setRoomId}
        joinRoom={joinRoom}
      />

      <section className="p-4">
        <h2 className="text-lg font-semibold">Online Users</h2>
        <ul className="mt-2 space-y-1">
          {users.map((user) => (
            <li
              key={user}
              className="rounded-md bg-slate-100 px-3 py-2"
            >
              {user}
            </li>
          ))}
        </ul>
      </section>

      <CodeEditor onMount={handleEditorMount} />
    </main>
  );
}
