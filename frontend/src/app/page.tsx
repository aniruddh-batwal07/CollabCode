"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/collaboration";

import CodeEditor from "@/components/CodeEditor";
import { useSocket } from "@/hooks/useSocket";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function Home() {
  const [roomId, setRoomId] = useState("room-1");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [cursorUsers, setCursorUsers] = useState<
    { id: string; username: string; line: number; column: number }[]
  >([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [output, setOutput] = useState("");

  const activeRoomRef = useRef<string | null>(null);
  const activeUsernameRef = useRef<string>("");
  const bindingRef = useRef<{ destroy(): void } | null>(null);
  const editorRef = useRef<any>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const widgetMapRef = useRef<Map<string, any>>(new Map());

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
  }, []);

  useEffect(() => {
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === socket) return;
      socket.emit("yjs-update", {
        roomId: activeRoomRef.current,
        update: Array.from(update),
      });
    };
    ydoc.on("update", updateHandler);
    return () => {
      ydoc.off("update", updateHandler);
    };
  }, []);

  const handleYjsUpdate = useCallback((update: number[]) => {
    Y.applyUpdate(ydoc, new Uint8Array(update), socket);
  }, []);

  const handleDocumentSync = useCallback((update: number[]) => {
    Y.applyUpdate(ydoc, new Uint8Array(update), socket);
  }, []);

  const handlePresenceUpdate = useCallback(
    (updatedUsers: { id: string; username: string }[]) => {
      setUsers(updatedUsers);
    },
    []
  );

  const handleCursorUpdate = useCallback(
    (users: { id: string; username: string; line: number; column: number }[]) => {
      setCursorUsers(users);
    },
    []
  );

  const handleSnapshotsList = useCallback((data: any[]) => {
    setSnapshots(data);
  }, []);

  const handleRestoreSync = useCallback((update: number[]) => {
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, new Uint8Array(update));
    const restoredText = tempDoc.getText("monaco").toString();
    tempDoc.destroy();

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, restoredText);
    }, socket);
  }, []);

  useSocket("yjs-update", handleYjsUpdate);
  useSocket("document-sync", handleDocumentSync);
  useSocket("presence-update", handlePresenceUpdate);
  useSocket("cursor-update", handleCursorUpdate);
  useSocket("snapshots-list", handleSnapshotsList);
  useSocket("restore-sync", handleRestoreSync);

  const handleCursorMove = (line: number, column: number) => {
    socket.emit("cursor-move", { roomId, line, column });
  };

  const joinRoom = () => {
    activeRoomRef.current = roomId;
    activeUsernameRef.current = username;

    if (socket.connected) {
      socket.emit("join-room", { roomId, username });
    } else {
      socket.connect();
    }
  };

  const loadSnapshots = () => {
    socket.emit("get-snapshots", roomId);
  };

  const restoreSnapshot = (snapshotId: number) => {
    socket.emit("restore-snapshot", { roomId, snapshotId });
  };

  const runCode = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "python", code: ytext.toString() }),
      });
      const data = await response.json();
      setOutput(data.output ?? data.error ?? "No output");
    } catch (error) {
      console.error(error);
      setOutput("Execution failed");
    }
  };

  const handleEditorMount = async (editor: any, _monaco: any) => {
    const model = editor.getModel();
    if (!model) return;

    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const { MonacoBinding } = await import("y-monaco");
    const binding = new MonacoBinding(ytext, model, new Set([editor]), null);
    bindingRef.current = binding;
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !cursorUsers.length) return;

    const myId = socket.id;

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

    const currentIds = new Set(cursorUsers.map((u) => u.id));

    widgetMapRef.current.forEach((widget, id) => {
      if (!currentIds.has(id) || id === myId) {
        editor.removeContentWidget(widget);
        widgetMapRef.current.delete(id);
      }
    });

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
            preference: [1, 2],
          }),
        };

        editor.addContentWidget(widget);
        widgetMapRef.current.set(u.id, widget);
      });
  }, [cursorUsers]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-slate-200 overflow-hidden">
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#111111] overflow-y-auto">
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

          <section className="p-3 border-b border-slate-700/60">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Cursor Positions
            </h2>
            <ul className="space-y-1">
              {cursorUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 bg-slate-800/60 text-sm text-slate-300"
                >
                  <span>{user.username}</span>
                  <span className="text-xs text-slate-500">L {user.line}</span>
                </li>
              ))}
              {cursorUsers.length === 0 && (
                <li className="text-xs text-slate-600 px-2">No cursors yet</li>
              )}
            </ul>
          </section>

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

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor onMount={handleEditorMount} onCursorMove={handleCursorMove} />
          </div>

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
