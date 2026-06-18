import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import * as Y from "yjs";

import { pool } from "./db/postgres";

import {
  saveDocument,
  getDocument,
} from "./persistence/documentRepository";

const app = express();

app.use(cors());

const server = http.createServer(app);

const roomUsers = new Map<string, Set<string>>();

const roomDocs = new Map<
  string,
  Uint8Array
>();

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
    async (roomId: string) => {
      socket.join(roomId);

      socket.data.roomId = roomId;

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }

      roomUsers
        .get(roomId)!
        .add(socket.id);

      io.to(roomId).emit(
        "presence-update",
        Array.from(
          roomUsers.get(roomId)!
        )
      );

      console.log(
        `${socket.id} joined ${roomId}`
      );

      let roomState: Uint8Array | undefined | null =
        roomDocs.get(roomId);

      if (!roomState) {
        roomState =
          await getDocument(roomId);

        if (roomState) {
          roomDocs.set(
            roomId,
            roomState
          );
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

  socket.on("disconnect", () => {
    const roomId =
      socket.data.roomId;

    if (
      roomId &&
      roomUsers.has(roomId)
    ) {
      roomUsers
        .get(roomId)!
        .delete(socket.id);

      io.to(roomId).emit(
        "presence-update",
        Array.from(
          roomUsers.get(roomId)!
        )
      );
    }

    console.log(
      `${socket.id} disconnected`
    );
  });
});

const PORT = 5000;

pool
  .query("SELECT NOW()")
  .then(() =>
    console.log(
      "Database connected"
    )
  )
  .catch((err) =>
    console.error(
      "Database connection failed",
      err
    )
  );

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});