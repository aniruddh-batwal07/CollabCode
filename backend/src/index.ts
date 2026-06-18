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
const userNames = new Map<string, string>();
const cursorPositions = new Map<string, number>();

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