import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import * as Y from "yjs";

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

  socket.on("join-room", (roomId: string) => {
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

    const roomState =
      roomDocs.get(roomId);

    if (roomState) {
      socket.emit(
        "document-sync",
        Array.from(roomState)
      );
    }
  });

  socket.on(
    "yjs-update",
    ({
      roomId,
      update,
    }: {
      roomId: string;
      update: number[];
    }) => {
      const incoming = new Uint8Array(update);
      const existing = roomDocs.get(roomId);
      roomDocs.set(
        roomId,
        existing
          ? Y.mergeUpdates([existing, incoming])
          : incoming
      );

      socket
        .to(roomId)
        .emit("yjs-update", update);
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

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});