"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/collaboration";

import CodeEditor from "@/components/CodeEditor";
import { useSocket } from "@/hooks/useSocket";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function EditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = searchParams.get("room") ?? "";
  const [username, setUsername] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [cursorUsers, setCursorUsers] = useState<
    { id: string; username: string; line: number; column: number }[]
  >([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const activeRoomRef = useRef<string | null>(null);
  const activeUsernameRef = useRef<string>("");
  const bindingRef = useRef<{ destroy(): void } | null>(null);
  const editorRef = useRef<any>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const widgetMapRef = useRef<Map<string, any>>(new Map());
  const joinedRef = useRef(false);

  // Redirect to landing if room or username is missing
  useEffect(() => {
    if (!roomId) { router.replace("/"); return; }
    const stored = localStorage.getItem("collabcode_username") ?? "";
    if (!stored) { router.replace("/"); return; }
    setUsername(stored);
  }, [roomId, router]);

  // Auto-join once username is resolved
  useEffect(() => {
    if (!roomId || !username || joinedRef.current) return;
    joinedRef.current = true;
    activeRoomRef.current = roomId;
    activeUsernameRef.current = username;
    if (socket.connected) {
      socket.emit("join-room", { roomId, username });
    } else {
      socket.connect();
    }
  }, [roomId, username]);

  // Reconnect handler
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
    return () => { socket.off("connect", handleConnect); };
  }, []);

  // Yjs update broadcaster
  useEffect(() => {
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === socket) return;
      socket.emit("yjs-update", {
        roomId: activeRoomRef.current,
        update: Array.from(update),
      });
    };
    ydoc.on("update", updateHandler);
    return () => { ydoc.off("update", updateHandler); };
  }, []);

  const handleYjsUpdate = useCallback((update: number[]) => {
    Y.applyUpdate(ydoc, new Uint8Array(update), socket);
  }, []);

  const handleDocumentSync = useCallback((update: number[]) => {
    Y.applyUpdate(ydoc, new Uint8Array(update), socket);
  }, []);

  const handlePresenceUpdate = useCallback(
    (updatedUsers: { id: string; username: string }[]) => setUsers(updatedUsers),
    []
  );

  const handleCursorUpdate = useCallback(
    (users: { id: string; username: string; line: number; column: number }[]) =>
      setCursorUsers(users),
    []
  );

  const handleSnapshotsList = useCallback((data: any[]) => setSnapshots(data), []);

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

  const loadSnapshots = () => { socket.emit("get-snapshots", roomId); };

  const restoreSnapshot = (snapshotId: number) => {
    socket.emit("restore-snapshot", { roomId, snapshotId });
  };

  const runCode = async () => {
    setIsRunning(true);
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
    } finally {
      setIsRunning(false);
    }
  };

  const exitRoom = () => {
    socket.emit("leave-room", { roomId });
    socket.disconnect();
    joinedRef.current = false;
    activeRoomRef.current = null;
    router.push("/");
  };

  const handleEditorMount = async (editor: any, _monaco: any) => {
    const model = editor.getModel();
    if (!model) return;
    if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null; }
    const { MonacoBinding } = await import("y-monaco");
    const binding = new MonacoBinding(ytext, model, new Set([editor]), null);
    bindingRef.current = binding;
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null; }
    };
  }, []);

  // Monaco cursor rendering (unchanged)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !cursorUsers.length) return;
    const myId = socket.id;

    const newDecorations = cursorUsers
      .filter((u) => u.id !== myId)
      .map((u) => ({
        range: { startLineNumber: u.line, startColumn: 1, endLineNumber: u.line, endColumn: 1 },
        options: { isWholeLine: true, className: "collaborator-line-highlight" },
      }));

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);

    const currentIds = new Set(cursorUsers.map((u) => u.id));
    widgetMapRef.current.forEach((widget, id) => {
      if (!currentIds.has(id) || id === myId) {
        editor.removeContentWidget(widget);
        widgetMapRef.current.delete(id);
      }
    });

    cursorUsers.filter((u) => u.id !== myId).forEach((u) => {
      const existingWidget = widgetMapRef.current.get(u.id);
      if (existingWidget) editor.removeContentWidget(existingWidget);

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

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-700/60 bg-[#111111] shrink-0">
        <button
          onClick={() => router.push("/")}
          className="text-sm font-bold tracking-tight text-white whitespace-nowrap hover:text-slate-300 transition-colors"
        >
          ⚡ CollabCode
        </button>

        <span className="text-slate-700">|</span>

        {/* Room ID badge */}
        <span
          title="Room ID — click to copy"
          onClick={() => navigator.clipboard?.writeText(roomId)}
          className="text-xs text-slate-400 font-mono bg-slate-800 border border-slate-700/80 rounded px-2 py-1 select-all cursor-pointer hover:border-slate-600 transition-colors"
        >
          {roomId}
        </span>

        {/* Current user */}
        {username && (
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
            {username}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={runCode}
            disabled={isRunning}
            className="rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {isRunning ? "Running…" : "▶ Run Code"}
          </button>

          <button
            onClick={exitRoom}
            className="rounded-md border border-slate-700 hover:border-slate-500 hover:text-slate-200 px-3 py-1.5 text-xs text-slate-500 transition-colors"
          >
            Exit Room
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#111111]">

          {/* Online Users */}
          <section className="p-4 border-b border-slate-800">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
              Online Users
            </h2>
            <ul className="space-y-1.5">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 bg-slate-800/50 text-sm text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{user.username}</span>
                </li>
              ))}
              {users.length === 0 && (
                <li className="text-xs text-slate-700 px-2">No users connected</li>
              )}
            </ul>
          </section>

          {/* Version History */}
          <section className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Version History
              </h2>
              <button
                className="rounded border border-slate-700 hover:border-slate-600 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                onClick={loadSnapshots}
              >
                Load
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-md border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-300">
                      Version #{snapshot.id}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 mb-2.5">
                    {new Date(snapshot.created_at).toLocaleString()}
                  </div>
                  <button
                    className="w-full rounded border border-slate-700 hover:border-slate-500 hover:bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    onClick={() => restoreSnapshot(snapshot.id)}
                  >
                    Restore this version
                  </button>
                </div>
              ))}
              {snapshots.length === 0 && (
                <p className="text-xs text-slate-700">
                  Press Load to view snapshots.
                </p>
              )}
            </div>
          </section>
        </aside>

        {/* ── Editor + Output ─────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor onMount={handleEditorMount} onCursorMove={handleCursorMove} />
          </div>

          {/* Output panel */}
          <div className="h-44 shrink-0 border-t border-slate-700/60 bg-[#0d0d0d] flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 shrink-0">
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 ml-1">
                Output
              </h2>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-xs text-slate-300 font-mono leading-relaxed">
              {output
                ? output
                : <span className="text-slate-700">$ run code to see output here…</span>
              }
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
