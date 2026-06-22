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
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [cursorUsers, setCursorUsers] =
    useState<
      { id: string; username: string; line: number }[]
    >([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [output, setOutput] = useState("");

  // Keep the latest joined roomId available to the reconnect handler
  // without needing it in any dependency array.
  const activeRoomRef = useRef<string | null>(null);
  const activeUsernameRef = useRef<string>("");

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
        socket.emit("join-room", {
          roomId: activeRoomRef.current,
          username: activeUsernameRef.current,
        });
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

  const handleDocumentSync = useCallback((update: number[]) => {
    Y.applyUpdate(
      ydoc,
      new Uint8Array(update),
      socket
    );
  }, []);

  const handlePresenceUpdate = useCallback((updatedUsers: { id: string; username: string }[]) => {
    setUsers(updatedUsers);
  }, []);

  useSocket("yjs-update", handleYjsUpdate);
  useSocket("document-sync", handleDocumentSync);
  useSocket("presence-update", handlePresenceUpdate);
  useSocket(
    "cursor-update",
    (users) => {
      setCursorUsers(users);
    }
  );
  useSocket("snapshots-list", (data) => {
    setSnapshots(data);
  });
  // Restore: the snapshot is a full encoded Y.Doc state (not an
  // incremental update). We cannot simply Y.applyUpdate onto the
  // existing ydoc because Yjs would deduplicate the ops it already
  // knows (they were applied when the user originally typed them).
  //
  // Instead: decode into a temp doc, read the plain text, then
  // replace ytext content in one transaction so MonacoBinding
  // sees a single atomic change and stays in sync.
  useSocket("restore-sync", (update: number[]) => {
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, new Uint8Array(update));
    const restoredText = tempDoc.getText("monaco").toString();
    tempDoc.destroy();

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, restoredText);
    }, socket); // origin = socket → updateHandler skips re-emit
  });

  // ── Join room ────────────────────────────────────────────────────
  const handleCursorMove = (line: number) => {
    socket.emit("cursor-move", {
      roomId,
      line,
    });
  };

  const joinRoom = () => {
    activeRoomRef.current = roomId;
    activeUsernameRef.current = username;

    // Connect the socket on first join (autoConnect: false in socket.ts).
    // On subsequent joins (room switch), the socket is already connected.
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-room", {
      roomId,
      username,
    });
  };

  const loadSnapshots = () => {
    socket.emit("get-snapshots", roomId);
  };

  const restoreSnapshot = (snapshotId: number) => {
    socket.emit("restore-snapshot", {
      roomId,
      snapshotId,
    });
  };

  const runCode = async () => {  try {    const response =      await fetch(        "http://localhost:5000/execute",        {          method: "POST",          headers: {            "Content-Type":              "application/json",          },          body: JSON.stringify({            language: "python",            code: ytext.toString(),          }),        }      );    const data =      await response.json();    setOutput(data.output);  } catch (error) {    console.error(error);    setOutput(      "Execution failed"    );  }};

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
      <div className="p-4">
        <label className="block text-sm font-medium text-slate-700">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          placeholder="Enter your name"
        />
      </div>

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
              key={user.id}
              className="rounded-md bg-slate-100 px-3 py-2"
            >
              {user.username}
            </li>
          ))}
        </ul>
      </section>

      <div className="p-4 border-b">
        <button
          onClick={runCode}
          className="      border      px-4      py-2      rounded    "
        >
          ▶ Run Code
        </button>
      </div>

      <CodeEditor
        onMount={handleEditorMount}
        onCursorMove={handleCursorMove}
      />

      <div className="h-40 border-t p-4 overflow-auto">
        <h2 className="font-semibold">
          Output
        </h2>
        <pre className="mt-2">
          {output}
        </pre>
      </div>

      <section className="p-4">
        <h2 className="text-lg font-semibold">
          Cursor Positions
        </h2>
        <ul className="mt-2 space-y-1">
          {cursorUsers.map((user) => (
            <li
              key={user.id}
              className="rounded-md bg-blue-50 px-3 py-2 text-sm"
            >
              {user.username} → Line {user.line}
            </li>
          ))}
        </ul>
      </section>

      <section className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Version History
          </h2>
          <button
            className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
            onClick={loadSnapshots}
          >
            Load
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="rounded-md bg-slate-100 p-3"
            >
              <div className="font-medium">
                Version #{snapshot.id}
              </div>
              <div className="text-sm text-slate-600">
                {new Date(snapshot.created_at).toLocaleString()}
              </div>
              <button
                className="mt-2 rounded bg-slate-800 px-3 py-2 text-sm text-white"
                onClick={() => restoreSnapshot(snapshot.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
