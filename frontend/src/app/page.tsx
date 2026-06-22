"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/collaboration";

import CodeEditor from "@/components/CodeEditor";

import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const [roomId, setRoomId] = useState("room-1");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [cursorUsers, setCursorUsers] =
    useState<
      { id: string; username: string; line: number; column: number }[]
    >();
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [output, setOutput] = useState("");

  // Keep the latest joined roomId available to the reconnect handler
  // without needing it in any dependency array.
  const activeRoomRef = useRef<string | null>(null);
  const activeUsernameRef = useRef<string>("");

  // Store the MonacoBinding so we can call .destroy() on cleanup,
  // preventing duplicate bindings from accumulating on re-mounts.
  const bindingRef = useRef<{ destroy(): void } | null>(null);

  // Holds the live Monaco editor instance so the cursor-update effect
  // can add decorations and content widgets without re-mounting.
  const editorRef = useRef<any>(null);

  // Track the IDs of all active collaborator decorations so we can
  // replace them atomically on every cursor-update.
  const decorationIdsRef = useRef<string[]>([]);

  // Keep a stable map of content widgets (one per remote socket id)
  // so we can remove stale ones when a user disconnects.
  const widgetMapRef = useRef<Map<string, any>>(new Map());

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

  const handleCursorUpdate = useCallback(
    (users: { id: string; username: string; line: number; column: number }[]) => {
      setCursorUsers(users);
    },
    []
  );

  useSocket("yjs-update", handleYjsUpdate);
  useSocket("document-sync", handleDocumentSync);
  useSocket("presence-update", handlePresenceUpdate);
  useSocket("cursor-update", handleCursorUpdate);
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
  const handleCursorMove = (line: number, column: number) => {
    socket.emit("cursor-move", {
      roomId,
      line,
      column,
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

    // Save editor reference for the collaborator cursor effect below.
    editorRef.current = editor;
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

  // ── Collaborator cursors ─────────────────────────────────────────
  // Runs whenever the server broadcasts a fresh cursor-update.
  // For every remote user we:
  //   1. Paint a full-line highlight decoration.
  //   2. Show/update a content widget with their username label.
  // Widgets from users no longer in the list are removed.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !cursorUsers) return;

    const myId = socket.id;

    // ── Decorations (line highlights) ──────────────────────────────
    const newDecorations = cursorUsers
      .filter((u) => u.id !== myId)
      .map((u) => ({
        range: {
          startLineNumber: u.line,
          startColumn: 1,
          endLineNumber: u.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "collaborator-line-highlight",
        },
      }));

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );

    // ── Content widgets (username labels) ──────────────────────────
    const currentIds = new Set(cursorUsers.map((u) => u.id));

    // Remove widgets for users who have left.
    widgetMapRef.current.forEach((widget, id) => {
      if (!currentIds.has(id) || id === myId) {
        editor.removeContentWidget(widget);
        widgetMapRef.current.delete(id);
      }
    });

    // Add or update a widget for each remote collaborator.
    cursorUsers
      .filter((u) => u.id !== myId)
      .forEach((u) => {
        const existingWidget = widgetMapRef.current.get(u.id);
        if (existingWidget) {
          editor.removeContentWidget(existingWidget);
        }

        const widget = {
          getId: () => `cursor-widget-${u.id}`,
          getDomNode: () => {
            const node = document.createElement("div");
            node.className = "collaborator-cursor-widget";
            node.textContent = u.username || "Anonymous";
            return node;
          },
          getPosition: () => ({
            position: { lineNumber: u.line, column: u.column },
            preference: [1, 2], // ABOVE then BELOW
          }),
        };

        editor.addContentWidget(widget);
        widgetMapRef.current.set(u.id, widget);
      });
  }, [cursorUsers]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-slate-200 overflow-hidden">

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/60 bg-[#111111] shrink-0">
        <span className="text-base font-bold tracking-tight text-white mr-2 whitespace-nowrap">
          ⚡ CollabCode
        </span>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-36 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          placeholder="Username"
        />

        <input
          className="w-36 rounded bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
        />

        <button
          className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm text-slate-100 transition-colors"
          onClick={joinRoom}
        >
          Join Room
        </button>

        <div className="ml-auto">
          <button
            onClick={runCode}
            className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors"
          >
            ▶ Run Code
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ──────────────────────────────────────────── */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#111111] overflow-y-auto">

          {/* Online Users */}
          <section className="p-3 border-b border-slate-700/60">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Online Users
            </h2>
            <ul className="space-y-1">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 bg-slate-800/60 text-sm text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {user.username}
                </li>
              ))}
              {users.length === 0 && (
                <li className="text-xs text-slate-600 px-2">No users yet</li>
              )}
            </ul>
          </section>

          {/* Cursor Positions */}
          <section className="p-3 border-b border-slate-700/60">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Cursor Positions
            </h2>
            <ul className="space-y-1">
              {(cursorUsers ?? []).map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 bg-slate-800/60 text-sm text-slate-300"
                >
                  <span>{user.username}</span>
                  <span className="text-xs text-slate-500">L {user.line}</span>
                </li>
              ))}
              {(cursorUsers ?? []).length === 0 && (
                <li className="text-xs text-slate-600 px-2">No cursors yet</li>
              )}
            </ul>
          </section>

          {/* Version History */}
          <section className="p-3 flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Version History
              </h2>
              <button
                className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs text-slate-300 transition-colors"
                onClick={loadSnapshots}
              >
                Load
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded border border-slate-700/60 bg-slate-800/40 p-2"
                >
                  <div className="text-sm font-semibold text-slate-200">
                    Version #{snapshot.id}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {new Date(snapshot.created_at).toLocaleString()}
                  </div>
                  <button
                    className="mt-1.5 w-full rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs text-slate-300 transition-colors"
                    onClick={() => restoreSnapshot(snapshot.id)}
                  >
                    Restore
                  </button>
                </div>
              ))}
              {snapshots.length === 0 && (
                <p className="text-xs text-slate-600">No snapshots loaded</p>
              )}
            </div>
          </section>
        </aside>

        {/* ── Editor + Output ───────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              onMount={handleEditorMount}
              onCursorMove={handleCursorMove}
            />
          </div>

          {/* Output Panel */}
          <div className="h-40 shrink-0 border-t border-slate-700/60 bg-[#111111] flex flex-col">
            <div className="flex items-center px-4 py-2 border-b border-slate-700/60">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Output
              </h2>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed">
              {output || <span className="text-slate-600">Run code to see output...</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
