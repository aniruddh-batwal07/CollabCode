<div align="center">

# CollabCode

**A real-time collaborative code editor built for teams — edit, sync, and version code simultaneously, from anywhere.**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white)](https://socket.io/)

</div>

---

CollabCode is a production-grade real-time collaborative code editor inspired by **Google Docs**, **VSCode Live Share**, and **Replit Multiplayer**. Multiple developers can write and edit code in a shared room simultaneously — with conflict-free CRDT merging, live cursors, version history, and an isolated code execution sandbox.

---

## Live Demo

🌐 **[https://collab-code-black-gamma.vercel.app](https://collab-code-black-gamma.vercel.app)**

> Open in two browser tabs and join the same Room ID to test real-time collaboration.

---

## Demo

<!-- Replace this line with: ![CollabCode demo](./docs/demo.gif) -->
> 🎥 **Demo GIF** — Record with [ScreenToGif](https://www.screentogif.com/) or [Kap](https://getkap.co/): join a room, type in two tabs, move cursors, restore a snapshot. Save as `docs/demo.gif` and replace the comment above.

---

## Metrics

| Metric | Result |
|---|---|
| Concurrent clients tested | 10 tabs, single room |
| Local sync latency | < 80 ms (LAN, measured via browser DevTools WS frames) |
| Redis Pub/Sub | Verified via `@socket.io/redis-adapter` (Upstash TLS) |
| Snapshot interval | Every 30 s for active rooms |
| DB writes per edit | 1 upsert (documents table) per Yjs update |
| Test suite | 15 tests — 4 unit (document repo) + 5 unit (snapshot repo) + 6 integration (socket) |
| Build time on Render | ~10 s (`tsc` clean compile) |

---

## Features

### ✏️ Real-Time Collaboration
- **Simultaneous multi-user editing** powered by Yjs CRDT synchronization
- **Conflict-free merging** — no locking, no last-write-wins overwriting
- **Live collaborator cursors** with name labels rendered inside Monaco Editor
- **Online presence tracking** — see who's in the room in real time
- **Cursor position tracking** — see exactly where each collaborator is typing

### 🔌 Connection & Reliability
- **Room-based collaboration** — isolated editing sessions per room ID
- **Reconnect recovery** — clients seamlessly re-sync on reconnection without data loss
- **Redis Pub/Sub scaling** — synchronize Yjs updates across multiple backend instances

### 💾 Persistence
- **PostgreSQL document storage** — autosave document state on every update
- **Version history snapshots** — point-in-time document captures every 30 seconds
- **Snapshot restoration** — restore any previous version with one click

### ⚙️ Code Execution Sandbox
- **Docker-based execution** — each run is isolated in a fresh container (local dev only)
- **Python code execution** with real-time output
- **Resource limits** — CPU, memory, and timeout constraints per run
- **Network isolation** — sandboxed containers have no external network access
- **Output panel** — view stdout/stderr directly in the editor UI

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Client A                        │
│           Monaco Editor + Yjs Provider               │
└─────────────────────────┬───────────────────────────┘
                          │  WebSocket (Socket.IO)
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Backend Server (Render)              │
│         Socket.IO Room Handler + Yjs Doc             │
└──────────┬──────────────────────────┬───────────────┘
           │  Redis Pub/Sub (Upstash) │  PostgreSQL (Supabase)
           ▼                          ▼
    Horizontal scaling           Persistent storage
    across instances             (documents + snapshots)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS v4, Monaco Editor |
| **Backend** | Node.js, Express, TypeScript, Socket.IO |
| **CRDT Sync** | Yjs |
| **Database** | PostgreSQL (Supabase) |
| **Cache / Pub-Sub** | Redis (Upstash) |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |
| **Execution Sandbox** | Docker (local dev only) |

---

## How Real-Time Collaboration Works

### WebSockets & Socket.IO

All collaboration happens over persistent **WebSocket** connections managed by Socket.IO. When a client connects, they join a named **room** corresponding to a shared document. Socket.IO handles reconnection, fallback transports, and room-level message routing automatically.

### Yjs & CRDTs

[Yjs](https://github.com/yjs/yjs) is the core synchronization engine. It implements a **CRDT (Conflict-free Replicated Data Type)** — a data structure mathematically guaranteed to reach the same final state on all peers, regardless of the order updates are applied.

Each document is represented as a `Y.Doc`. Edits are encoded as compact binary **update messages** and broadcast to all peers in the room via Socket.IO. Each peer applies incoming updates to its local `Y.Doc`, merging them with its own local state.

### Conflict Resolution

Because Yjs uses CRDTs, there are **no traditional conflicts** to resolve:
- Concurrent insertions at the same position are deterministically ordered by a unique client ID and logical clock.
- Deletions are recorded as tombstones, not destructive removals, preventing re-insertion of deleted text.
- The result is **eventual consistency** — every client converges to the same document state without coordination locks.

---

## Redis Scaling

In a single-node deployment, the Yjs document lives in server memory. In a **multi-node deployment**, Redis **Pub/Sub** solves cross-instance synchronization:

1. When a Yjs update arrives on Server A, Server A publishes it to a Redis channel keyed by room ID.
2. All other server instances receive the update and forward it to their locally connected clients.
3. The result is transparent cross-instance broadcasting — clients connected to different servers collaborate seamlessly.

---

## Persistence Layer

### Documents Table

Stores the **current encoded state** of each Yjs document as a binary blob. Updated on every change. On server restart or new client join, the document is loaded from PostgreSQL and used as the authoritative initial state.

### Snapshots Table

Stores **point-in-time version captures**. Snapshots are taken automatically every 30 seconds for active rooms. Each snapshot stores the full Yjs binary state, allowing any historical version to be restored.

---

## Project Structure

```
collabcode/
├── frontend/                  # Next.js application
│   └── src/
│       ├── app/               # App Router pages and layout
│       ├── components/        # CodeEditor component
│       ├── hooks/             # useSocket custom hook
│       ├── lib/               # Yjs doc singleton, Socket.IO client
│       └── types/             # Shared TypeScript types
│
├── backend/                   # Express + Socket.IO server
│   └── src/
│       ├── db/                # PostgreSQL pool, Redis client
│       ├── persistence/       # Document and snapshot repositories
│       ├── routes/            # HTTP routes (execute)
│       ├── sandbox/           # Docker execution runner (local dev)
│       └── index.ts           # Server entry point
│
├── shared/                    # Shared TypeScript types
├── docs/                      # Architecture notes
├── docker-compose.yml         # Local development stack
├── render.yaml                # Render deployment config
└── README.md
```

---

## Local Development Setup

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for code execution sandbox)
- [PostgreSQL 15+](https://www.postgresql.org/) (or use Docker Compose)
- [Redis 7+](https://redis.io/) (or use Docker Compose)

### 1. Clone the Repository

```bash
git clone https://github.com/aniruddh-batwal07/realtime-collaborative-code-editor.git
cd realtime-collaborative-code-editor
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:5000`.

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:3000`.

### 5. Open a Room

Navigate to `http://localhost:3000`, enter a username and room ID, and click **Join Room**. Open the same URL in a second browser tab with the same room ID to test real-time collaboration.

---

## Deployment

| Service | Platform | Environment Variables |
|---|---|---|
| **Frontend** | Vercel | `NEXT_PUBLIC_BACKEND_URL` |
| **Backend** | Render | `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL` |
| **Database** | Supabase | — |
| **Redis** | Upstash | — |

> The Docker execution sandbox is disabled on hosted deployments (Render free tier does not provide Docker). Code execution returns a 503 in production; it works fully in local development.

---

## Key Engineering Concepts

| Concept | Implementation |
|---|---|
| **Real-time networking** | WebSocket connections via Socket.IO with room-based routing |
| **Distributed systems** | Multi-instance backend coordination via Redis Pub/Sub |
| **CRDTs** | Yjs Y.Doc for conflict-free concurrent document editing |
| **Eventual consistency** | All peers converge to the same document state without locking |
| **Pub/Sub architecture** | Redis channels per room enable horizontal backend scaling |
| **Persistence strategies** | Autosave on every update + versioned snapshot capture and restore |
| **Sandboxed execution** | Docker container isolation with resource constraints (local dev) |

---

## Future Scope

- Support for additional languages (JavaScript, Go, C++)
- Inline commenting and annotation threads
- GitHub OAuth and persistent user accounts
- Shareable read-only room links
- Integrated voice/video channel per room

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built by [Aniruddh Batwal](https://github.com/aniruddh-batwal07)

</div>