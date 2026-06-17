import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());

const server = http.createServer(app);

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

    console.log(`${socket.id} joined ${roomId}`);
  });

  socket.on(
    "send-message",
    ({
      roomId,
      message,
    }: {
      roomId: string;
      message: string;
    }) => {
      console.log(
        `[${roomId}] ${socket.id}: ${message}`
      );

      io.to(roomId).emit(
        "receive-message",
        message
      );
    }
  );

  socket.on(
    "code-change",
    ({
      roomId,
      code,
    }: {
      roomId: string;
      code: string;
    }) => {
      socket
        .to(roomId)
        .emit("receive-code", code);
    }
  );

  socket.on(
    "yjs-update",
    ({
      roomId,
      update,
    }: {
      roomId: string;
      update: number[];
    }) => {
      socket
        .to(roomId)
        .emit("yjs-update", update);
    }
  );

  socket.on("disconnect", () => {
    console.log(
      `User disconnected: ${socket.id}`
    );
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});