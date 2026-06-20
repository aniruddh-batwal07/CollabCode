import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import * as Y from "yjs";

import { initDb } from "./db/postgres";
import {
  pubClient,
  subClient,
} from "./db/redis";

import { createAdapter }
from "@socket.io/redis-adapter";

import {
  saveDocument,
  getDocument,
} from "./persistence/documentRepository";
import {
  createSnapshot,
  getSnapshots,
  getSnapshotById,
} from "./persistence/snapshotRepository";

import executeRouter from "./routes/execute";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));
app.use("/execute", executeRouter);

const server = http.createServer(app);

const roomUsers = new Map<string, Set<string>>();
const userNames = new Map<string, string>();
const cursorPositions = new Map<string, number>();

const roomDocs = new Map<
  string,
  Uint8Array
>();

setInterval(async () => {
  try {
    for (const [
      roomId,
      state,
    ] of roomDocs.entries()) {
      await createSnapshot(
        roomId,
        state
      );
    }

    console.log(
      "Snapshots saved"
    );
  } catch (error) {
    console.error(
      "Snapshot job failed",
      error
    );
  }
}, 30000);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

app.get("/", (_, res) => {
  res.send("Backend running");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on(
    "join-room",
    async ({
      roomId,
      username,
    }: {
      roomId: string;
      username: string;
    }) => {
      socket.join(roomId);

      socket.data.roomId = roomId;
      userNames.set(socket.id, username);

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }

      roomUsers
        .get(roomId)!
        .add(socket.id);

      const users =
        Array.from(
          roomUsers.get(roomId)!
        ).map((id) => ({
          id,
          username:
            userNames.get(id) ||
            "Anonymous",
        }));

      io.to(roomId).emit(
        "presence-update",
        users
      );

      console.log(
        `${socket.id} joined ${roomId}`
      );

      let roomState: Uint8Array | undefined | null =
        roomDocs.get(roomId);

      if (!roomState) {
        const dbState =
          await getDocument(roomId);

        // Re-check roomDocs after the async DB read — a concurrent
        // yjs-update may have populated it while we were awaiting.
        // Prefer the in-memory merged state (more recent) over the
        // DB snapshot (may pre-date edits that arrived during the await).
        roomState = roomDocs.get(roomId);

        if (!roomState && dbState) {
          roomDocs.set(
            roomId,
            dbState
          );
          roomState = dbState;
        }
      }

      if (roomState) {
        socket.emit(
          "document-sync",
          Array.from(roomState)
        );
      }
    }
  );

  socket.on(
    "cursor-move",
    ({
      roomId,
      line,
    }: {
      roomId: string;
      line: number;
    }) => {
      cursorPositions.set(socket.id, line);

      const users =
        Array.from(
          roomUsers.get(roomId) || []
        ).map((id) => ({
          id,
          username:
            userNames.get(id) ||
            "Anonymous",
          line:
            cursorPositions.get(id) ||
            1,
        }));

      io.to(roomId).emit(
        "cursor-update",
        users
      );
    }
  );

  socket.on(
    "yjs-update",
    async ({
      roomId,
      update,
    }: {
      roomId: string;
      update: number[];
    }) => {
      const incoming =
        new Uint8Array(update);

      const existing =
        roomDocs.get(roomId);

      roomDocs.set(
        roomId,
        existing
          ? Y.mergeUpdates([
              existing,
              incoming,
            ])
          : incoming
      );

      await saveDocument(
        roomId,
        roomDocs.get(roomId)!
      );

      

      socket
        .to(roomId)
        .emit(
          "yjs-update",
          update
        );
    }
  );

  // ── Version History ──────────────────────────────────────────────
  socket.on(
    "get-snapshots",
    async (roomId: string) => {
      const snapshots =
        await getSnapshots(roomId);

      socket.emit(
        "snapshots-list",
        snapshots
      );
    }
  );

  socket.on(
    "restore-snapshot",
    async ({
      roomId,
      snapshotId,
    }: {
      roomId: string;
      snapshotId: number;
    }) => {
      const snapshot =
        await getSnapshotById(
          snapshotId
        );

      if (!snapshot) {
        return;
      }

      roomDocs.set(
        roomId,
        snapshot
      );

      await saveDocument(
        roomId,
        snapshot
      );

      io.to(roomId).emit(
        "restore-sync",
        Array.from(snapshot)
      );
    }
  );

  // ── Disconnect ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (
      roomId &&
      roomUsers.has(roomId)
    ) {
      roomUsers
        .get(roomId)!
        .delete(socket.id);

      const users =
        Array.from(
          roomUsers.get(roomId)!
        ).map((id) => ({
          id,
          username:
            userNames.get(id) ||
            "Anonymous",
        }));

      io.to(roomId).emit(
        "presence-update",
        users
      );
    }

    userNames.delete(socket.id);
  });
});

const PORT = Number(process.env.PORT) || 5000;

async function connectRedis() {
  await pubClient.connect();
  await subClient.connect();

  io.adapter(
    createAdapter(
      pubClient,
      subClient
    )
  );

  console.log(
    "Redis connected"
  );
}

connectRedis();

initDb()
  .then(() => {
    console.log(
      "Database connected"
    );
    server.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );
    });
  })
  .catch((err) => {
    console.error(
      "Database initialisation failed",
      err
    );
    process.exit(1);
  });