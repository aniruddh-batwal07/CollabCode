<div align="center">

# CollabCode

**A real-time collaborative code editor built for teams — edit, run, and synchronize code simultaneously, from anywhere.**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED)](https://www.docker.com/)

</div>

---

CollabCode is a production-grade, real-time collaborative code editor inspired by **Google Docs**, **VSCode Live Share**, and **Replit Multiplayer**. It enables multiple developers to write, edit, and execute code in a shared room simultaneously — with conflict-free merging, live cursors, version history, and an isolated code execution sandbox.

---

## Demo

> 🎥 **[Live Demo — Coming Soon](#)**
>
> Screenshots and a hosted demo will be available here once deployed.

---

## Features

### ✏️ Real-Time Collaboration
- **Simultaneous multi-user editing** powered by Yjs CRDT synchronization
- **Conflict-free merging** — no locking, no last-write-wins overwriting
- **Live collaborator cursors** with name labels rendered inside Monaco Editor
- **Online presence tracking** — see who's in the room in real time
- **Cursor position tracking** — see exactly where each collaborator is typing

### 🔌 Connection & Reliability
- **Room-based collaboration** — isolated editing sessions per room
- **Reconnect recovery** — clients seamlessly re-sync on reconnection without data loss
- **Redis Pub/Sub scaling** — synchronize Yjs updates across multiple backend instances

### 💾 Persistence
- **PostgreSQL document storage** — autosave document state on every update
- **Version history snapshots** — point-in-time document captures
- **Snapshot restoration** — restore any previous version with one click

### ⚙️ Code Execution Sandbox
- **Docker-based execution** — each run is isolated in a fresh container
- **Python code execution** with real-time output streaming
- **CPU limits** — prevent runaway compute usage
- **Memory limits** — hard cap per execution
- **Execution timeout** — auto-kill long-running or infinite-loop programs
- **Network isolation** — sandboxed containers have no external network access
- **Output panel** — view stdout/stderr directly in the editor UI

---

## Screenshots

| Editor View | Live Cursors | Version History |
|---|---|---|
| *(screenshot placeholder)* | *(screenshot placeholder)* | *(screenshot placeholder)* |

| Room Lobby | Code Execution Output | Snapshot Restore |
|---|---|---|
| *(screenshot placeholder)* | *(screenshot placeholder)* | *(screenshot placeholder)* |

---

## Architecture

CollabCode is composed of a **Next.js frontend**, a **Node.js/Express + Socket.IO backend**, a **PostgreSQL persistence layer**, a **Redis Pub/Sub layer** for horizontal scaling, and a **Docker execution sandbox**.

### Real-Time Collaboration Flow

```
┌─────────────────────────────────────────────────────┐
│                      Client A                        │
│           Monaco Editor + Yjs Provider               │
└─────────────────────────┬───────────────────────────┘
                          │  WebSocket (Socket.IO)
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Backend Server                      │
│         Socket.IO Room Handler + Yjs Doc             │
└──────────┬──────────────────────────┬───────────────┘
           │  Redis Pub/Sub           │  Redis Pub/Sub
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────┐
│  Backend Node 2  │      │      Backend Node 3       │
└──────────────────┘      └──────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────┐
│    Client B      │      │         Client C          │
└──────────────────┘      └──────────────────────────┘
```

### Persistence Flow

```
┌─────────────────────────────────────────────────────┐
│                      Client                          │
│              (Yjs document update)                   │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Yjs Document                       │
│           (in-memory CRDT state vector)              │
└──────────────────────┬──────────────────────────────┘
                       │  debounced autosave
                       ▼
┌─────────────────────────────────────────────────────┐
│                   PostgreSQL                         │
│    documents table (current state, encoded binary)   │
└──────────────────────┬──────────────────────────────┘
                       │  on-demand / scheduled
                       ▼
┌─────────────────────────────────────────────────────┐
│               Snapshots Table                        │
│       (versioned binary snapshots + metadata)        │
└─────────────────────────────────────────────────────┘
```

### Code Execution Flow

```
┌─────────────────────────────────────────────────────┐
│                      Client                          │
│            (Run button → Socket event)               │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│               Backend Execution Service              │
│           (spawns isolated Docker container)         │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Docker Container      │
          │  • Python runtime       │
          │  • CPU limit enforced   │
          │  • Memory cap enforced  │
          │  • Network disabled     │
          │  • Timeout watchdog     │
          └────────────┬────────────┘
                       │  stdout / stderr
                       ▼
┌─────────────────────────────────────────────────────┐
│            Output Panel (Client UI)                  │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Monaco Editor |
| **Backend** | Node.js, Express, TypeScript, Socket.IO |
| **CRDT Sync** | Yjs |
| **Database** | PostgreSQL |
| **Cache / Pub-Sub** | Redis |
| **Execution Sandbox** | Docker |

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
- The result is **eventual consistency** — every client converges to the same document state without coordination locks, operational transforms, or server-side arbitration.

---

## Redis Scaling

In a single-node deployment, the Yjs document lives in server memory and Socket.IO handles room broadcasting natively. In a **multi-node deployment**, each server instance only knows about the clients directly connected to it.

Redis **Pub/Sub** solves this:

1. When a Yjs update arrives on Server A, Server A publishes the binary update to a Redis channel keyed by room ID (`room:<roomId>`).
2. All other server instances subscribed to that channel receive the update and forward it to their locally connected clients in that room.
3. The result is transparent cross-instance broadcasting — clients connected to different servers collaborate as if on the same server.

This architecture allows CollabCode to scale horizontally by adding backend instances behind a load balancer without any application-level coordination logic.

---

## Persistence Layer

### Documents Table

Stores the **current encoded state** of each Yjs document as a binary blob. This is updated on every debounced autosave (triggered by document changes). On server restart or new client join, the document is loaded from PostgreSQL, hydrated into a fresh `Y.Doc`, and used as the authoritative initial state.

```sql
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT UNIQUE NOT NULL,
  content     BYTEA NOT NULL,         -- Yjs encoded state vector
  language    TEXT NOT NULL DEFAULT 'python',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Snapshots Table

Stores **point-in-time version captures** of documents. Snapshots are taken on-demand (manual save) or on a scheduled interval. Each snapshot stores the full Yjs binary state, allowing any historical version to be restored by loading its binary into a `Y.Doc` and re-broadcasting the state to connected clients.

```sql
CREATE TABLE snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     BYTEA NOT NULL,         -- Yjs snapshot binary
  label       TEXT,                   -- optional user-provided label
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Collaborative Execution Sandbox

Code execution is handled entirely inside **ephemeral Docker containers** to ensure complete isolation from the host system and between users.

### Execution Lifecycle

1. The client sends a **run event** via Socket.IO with the current document content.
2. The backend writes the code to a temporary file and invokes `docker run` with the execution parameters.
3. The container runs the code and streams `stdout`/`stderr` back to the backend process.
4. Output is forwarded to the client via Socket.IO and rendered in the **Output Panel**.
5. The container is destroyed immediately after execution completes or times out.

### Isolation Guarantees

| Constraint | Implementation |
|---|---|
| **CPU limit** | `--cpus` flag — fraction of a CPU core allocated per run |
| **Memory limit** | `--memory` flag — hard cap (e.g., 128MB) per container |
| **Execution timeout** | `--stop-timeout` + watchdog process kills container after N seconds |
| **Network isolation** | `--network none` — no inbound or outbound network access |
| **Filesystem isolation** | Read-only base image; code injected via volume mount to `/tmp` |

---

## Project Structure

```
collabcode/
├── frontend/                  # Next.js application
│   ├── app/                   # App Router pages and layouts
│   ├── components/            # UI components (Editor, Output, Sidebar)
│   ├── hooks/                 # Custom React hooks (useCollaboration, useRoom)
│   ├── lib/                   # Yjs provider setup, Socket.IO client
│   └── styles/                # Tailwind global styles
│
├── backend/                   # Express + Socket.IO server
│   ├── ws/                    # WebSocket connection handlers
│   ├── rooms/                 # Room lifecycle management
│   ├── sync/                  # Yjs document sync logic & Redis bridge
│   ├── persistence/           # PostgreSQL queries (documents, snapshots)
│   ├── execution/             # Docker sandbox runner
│   └── index.ts               # Server entry point
│
├── shared/                    # Shared TypeScript types and constants
│
├── docs/                      # Architecture diagrams and design notes
│
├── docker-compose.yml         # Local development stack
├── .env.example               # Environment variable template
└── README.md
```

---

## Local Development Setup

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [PostgreSQL 15+](https://www.postgresql.org/) (or use Docker Compose)
- [Redis 7+](https://redis.io/) (or use Docker Compose)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/collabcode.git
cd collabcode
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Backend
PORT=4000
FRONTEND_URL=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/collabcode

# Redis
REDIS_URL=redis://localhost:6379

# Docker Execution
EXECUTION_TIMEOUT_MS=10000
EXECUTION_MEMORY_LIMIT=128m
EXECUTION_CPU_LIMIT=0.5
```

### 3. Start Infrastructure (PostgreSQL + Redis)

Using Docker Compose (recommended for local dev):

```bash
docker compose up -d postgres redis
```

Or connect to your own PostgreSQL and Redis instances by setting the URLs in `.env`.

### 4. Run Database Migrations

```bash
cd backend
npm install
npm run migrate
```

### 5. Start the Backend

```bash
# from /backend
npm run dev
```

The backend starts on `http://localhost:4000`.

### 6. Start the Frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:3000`.

### 7. Open a Room

Navigate to `http://localhost:3000` and create or join a room. Open the same URL in a second browser tab to test real-time collaboration.

---

## Deployment Notes

- **Frontend**: Deploy to [Vercel](https://vercel.com/) or any static/SSR host. Set `NEXT_PUBLIC_BACKEND_URL` to your backend's public URL.
- **Backend**: Deploy to any Node.js-compatible host (Railway, Render, EC2, etc.). Ensure WebSocket connections are supported (disable HTTP-only proxies).
- **PostgreSQL**: Use a managed provider (Supabase, Railway, RDS, Neon).
- **Redis**: Use a managed provider (Upstash, Redis Cloud, ElastiCache).
- **Docker Sandbox**: The execution backend must run on a host with Docker installed. Do **not** run the execution service in a serverless environment.
- **Load Balancing**: When running multiple backend instances, configure your load balancer for **sticky sessions** (or rely on Redis Pub/Sub for cross-instance sync). Ensure Socket.IO's `adapter` is set to `socket.io-redis`.

---

## Key Engineering Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **Real-time networking** | WebSocket connections via Socket.IO with room-based routing |
| **Distributed systems** | Multi-instance backend coordination via Redis Pub/Sub |
| **CRDTs** | Yjs Y.Doc for conflict-free concurrent document editing |
| **Eventual consistency** | All peers converge to the same document state without locking |
| **Pub/Sub architecture** | Redis channels per room enable horizontal backend scaling |
| **Collaborative systems** | Shared mutable state, presence, and cursor awareness across peers |
| **Sandboxed execution** | Docker container isolation with resource constraints |
| **Persistence strategies** | Autosave with debounce + versioned snapshot capture and restore |

---

## Future Scope

- Support for additional languages in the execution sandbox (JavaScript, Go, C++)
- Inline commenting and annotation threads
- Integrated voice/video channel per room
- GitHub OAuth and persistent user accounts
- Shareable read-only room links

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built by [Aniruddh Batwal](https://github.com/aniruddh-batwal07)

</div>