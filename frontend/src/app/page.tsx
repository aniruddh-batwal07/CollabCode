"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "room-";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

const FEATURES = [
  { icon: "⚡", title: "Real-Time Collaboration", desc: "Every keystroke syncs instantly across all connected clients with sub-100ms latency." },
  { icon: "🔄", title: "Conflict-Free CRDT Sync", desc: "Yjs CRDT guarantees correctness even during concurrent edits and network partitions." },
  { icon: "👥", title: "Live Collaborator Cursors", desc: "See exactly where teammates are editing, rendered directly inside Monaco." },
  { icon: "🕒", title: "Version History", desc: "Automatic snapshots every 30 seconds. Restore any previous state instantly." },
  { icon: "⚙", title: "Docker Sandbox", desc: "Execute Python code safely in an isolated Docker container with captured output." },
  { icon: "📡", title: "Redis Pub/Sub Scaling", desc: "Socket.IO backed by Redis adapter for horizontal scaling across multiple servers." },
];

const TECH_STACK = [
  { name: "Yjs", desc: "CRDT engine" },
  { name: "Socket.IO", desc: "WebSocket transport" },
  { name: "Redis", desc: "Pub/Sub & scaling" },
  { name: "PostgreSQL", desc: "Snapshot storage" },
  { name: "Monaco Editor", desc: "VS Code engine" },
  { name: "Next.js", desc: "React framework" },
];

export default function LandingPage() {
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinUsername, setJoinUsername] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyRoomId = () => {
    if (navigator.clipboard && joinRoomId) {
      navigator.clipboard.writeText(joinRoomId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCreateRoom = () => {
    const roomId = generateRoomId();
    setIsCreating(true);
    setJoinRoomId(roomId);
    setJoinUsername("");
    setJoinError("");
    setShowJoin(true);
  };

  const handleOpenJoin = () => {
    setIsCreating(false);
    setJoinRoomId("");
    setJoinUsername("");
    setJoinError("");
    setShowJoin(true);
  };

  const handleJoinSubmit = () => {
    const trimmedUser = joinUsername.trim();
    const trimmedRoom = joinRoomId.trim();
    if (!trimmedUser) { setJoinError("Please enter a username."); return; }
    if (!trimmedRoom) { setJoinError("Please enter a room ID."); return; }
    localStorage.setItem("collabcode_username", trimmedUser);
    router.push(`/editor?room=${encodeURIComponent(trimmedRoom)}`);
  };

  const closeModal = () => {
    setShowJoin(false);
    setJoinError("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-slate-800/80 px-6 py-3.5 flex items-center gap-4 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-40">
        <span className="text-base font-bold tracking-tight text-white select-none">
          ⚡ CollabCode
        </span>
        <span className="hidden sm:inline text-slate-600 text-xs">|</span>
        <span className="hidden sm:inline text-xs text-slate-500">
          Built with Yjs, Redis &amp; Socket.IO
        </span>
        <div className="ml-auto">
          <a
            href="https://github.com/aniruddh-batwal07/CollabCode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-2xl w-full">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-full px-3 py-1 text-xs text-slate-400 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"></span>
            Open-source · No sign-up required
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-4">
            CollabCode
          </h1>
          <p className="text-slate-300 text-xl mb-4 font-light">
            Real-Time Collaborative Code Editor
          </p>
          <p className="text-slate-500 text-sm mb-10 max-w-lg mx-auto leading-relaxed">
            Multiple developers can edit the same document simultaneously.
            Powered by CRDT synchronization (Yjs) — changes propagate instantly,
            conflicts are resolved automatically.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
            <button
              id="btn-create-room"
              onClick={handleCreateRoom}
              className="bg-white text-[#0a0a0a] font-semibold px-8 py-3 rounded-md hover:bg-slate-100 transition-colors text-sm"
            >
              + Create Room
            </button>
            <button
              id="btn-join-room"
              onClick={handleOpenJoin}
              className="bg-transparent border border-slate-600 text-slate-300 font-semibold px-8 py-3 rounded-md hover:border-slate-400 hover:text-white transition-colors text-sm"
            >
              → Join Room
            </button>
          </div>

          {/* ── Feature Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-16 text-left">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-slate-900/60 border border-slate-800 rounded-lg p-4"
              >
                <div className="text-lg mb-2">{f.icon}</div>
                <div className="text-sm font-semibold text-slate-200 mb-1">{f.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* ── Tech Stack ────────────────────────────────────────────── */}
          <div className="border-t border-slate-800 pt-10">
            <p className="text-xs uppercase tracking-widest text-slate-600 mb-5">
              Technology Stack
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {TECH_STACK.map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-md px-3 py-2"
                >
                  <span className="text-sm font-semibold text-slate-300">{tech.name}</span>
                  <span className="text-xs text-slate-600">— {tech.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <span>Built by <span className="text-slate-400 font-medium">Aniruddh Batwal</span></span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/aniruddh-batwal07"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/aniruddhbatwal"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </footer>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showJoin && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center px-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-[#111111] border border-slate-700/80 rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-white">
                {isCreating ? "Create a Room" : "Join a Room"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isCreating
                  ? "A room ID has been generated for you."
                  : "Enter your username and an existing room ID."}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="modal-username" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Username
                </label>
                <input
                  id="modal-username"
                  type="text"
                  value={joinUsername}
                  onChange={(e) => { setJoinUsername(e.target.value); setJoinError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinSubmit()}
                  className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                  placeholder="e.g. alice"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="modal-room" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Room ID
                </label>
                <div className="relative">
                  <input
                    id="modal-room"
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => { setJoinRoomId(e.target.value); setJoinError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinSubmit()}
                    className="w-full rounded-md bg-slate-800 border border-slate-700 pl-3 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono transition-colors"
                    placeholder="e.g. room-a8d39f"
                  />
                  {joinRoomId && (
                    <button
                      onClick={handleCopyRoomId}
                      title="Copy Room ID"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1.5 rounded transition-colors"
                    >
                      {isCopied ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {joinError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span>⚠</span> {joinError}
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                id="modal-cancel"
                onClick={closeModal}
                className="flex-1 rounded-md border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                id="modal-join"
                onClick={handleJoinSubmit}
                className="flex-1 rounded-md bg-white text-[#0a0a0a] font-semibold px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors"
              >
                {isCreating ? "Create →" : "Join →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
