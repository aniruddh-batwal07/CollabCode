import { createServer } from "http";
import { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import * as Y from "yjs";

function buildTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const roomUsers = new Map<string, Set<string>>();
  const userNames = new Map<string, string>();
  const cursorPositions = new Map<string, number>();
  const cursorColumns = new Map<string, number>();
  const roomDocs = new Map<string, Uint8Array>();

  io.on("connection", (socket) => {
    socket.on("join-room", ({ roomId, username }: { roomId: string; username: string }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      userNames.set(socket.id, username);

      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
      roomUsers.get(roomId)!.add(socket.id);

      const users = Array.from(roomUsers.get(roomId)!).map((id) => ({
        id,
        username: userNames.get(id) || "Anonymous",
      }));
      io.to(roomId).emit("presence-update", users);

      const state = roomDocs.get(roomId);
      if (state) socket.emit("document-sync", Array.from(state));
    });

    socket.on("yjs-update", ({ roomId, update }: { roomId: string; update: number[] }) => {
      const incoming = new Uint8Array(update);
      const existing = roomDocs.get(roomId);
      roomDocs.set(roomId, existing ? Y.mergeUpdates([existing, incoming]) : incoming);
      socket.to(roomId).emit("yjs-update", update);
    });

    socket.on("cursor-move", ({ roomId, line, column }: { roomId: string; line: number; column: number }) => {
      cursorPositions.set(socket.id, line);
      cursorColumns.set(socket.id, column);
      const users = Array.from(roomUsers.get(roomId) || []).map((id) => ({
        id,
        username: userNames.get(id) || "Anonymous",
        line: cursorPositions.get(id) || 1,
        column: cursorColumns.get(id) || 1,
      }));
      io.to(roomId).emit("cursor-update", users);
    });

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId && roomUsers.has(roomId)) {
        roomUsers.get(roomId)!.delete(socket.id);
        const users = Array.from(roomUsers.get(roomId)!).map((id) => ({
          id,
          username: userNames.get(id) || "Anonymous",
        }));
        io.to(roomId).emit("presence-update", users);
      }
      userNames.delete(socket.id);
      cursorPositions.delete(socket.id);
      cursorColumns.delete(socket.id);
    });
  });

  return { io, httpServer };
}

function connect(port: number): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const client = ioc(`http://localhost:${port}`, { forceNew: true });
    client.on("connect", () => resolve(client));
  });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

let io: Server;
let httpServer: ReturnType<typeof createServer>;
let port: number;

beforeAll((done) => {
  const built = buildTestServer();
  io = built.io;
  httpServer = built.httpServer;
  httpServer.listen(0, () => {
    port = (httpServer.address() as AddressInfo).port;
    done();
  });
});

afterAll((done) => {
  io.close();
  httpServer.close(done);
});

describe("join-room", () => {
  it("adds the user and emits presence-update to the room", async () => {
    const client = await connect(port);
    const presencePromise = waitFor<{ id: string; username: string }[]>(client, "presence-update");

    client.emit("join-room", { roomId: "test-room", username: "Alice" });

    const users = await presencePromise;
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("Alice");

    client.disconnect();
  });

  it("broadcasts updated presence when a second user joins", async () => {
    const c1 = await connect(port);
    const c2 = await connect(port);

    c1.emit("join-room", { roomId: "shared-room", username: "Bob" });
    await waitFor(c1, "presence-update");

    const presencePromise = waitFor<{ id: string; username: string }[]>(c1, "presence-update");
    c2.emit("join-room", { roomId: "shared-room", username: "Carol" });

    const users = await presencePromise;
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.username)).toContain("Carol");

    c1.disconnect();
    c2.disconnect();
  });
});

describe("leave room (disconnect)", () => {
  it("removes the user from presence after disconnect", async () => {
    const c1 = await connect(port);
    const c2 = await connect(port);

    c1.emit("join-room", { roomId: "leave-room", username: "Dave" });
    await waitFor(c1, "presence-update");

    c2.emit("join-room", { roomId: "leave-room", username: "Eve" });
    await waitFor(c1, "presence-update");

    const afterLeave = waitFor<{ id: string; username: string }[]>(c1, "presence-update");
    c2.disconnect();

    const users = await afterLeave;
    expect(users.every((u) => u.username !== "Eve")).toBe(true);

    c1.disconnect();
  });
});

describe("yjs-update", () => {
  it("broadcasts the update to other clients in the same room", async () => {
    const c1 = await connect(port);
    const c2 = await connect(port);

    c1.emit("join-room", { roomId: "yjs-room", username: "A" });
    await waitFor(c1, "presence-update");
    c2.emit("join-room", { roomId: "yjs-room", username: "B" });
    await waitFor(c1, "presence-update");

    const updateReceivedByC2 = waitFor<number[]>(c2, "yjs-update");
    c1.emit("yjs-update", { roomId: "yjs-room", update: [1, 2, 3] });

    const received = await updateReceivedByC2;
    expect(received).toEqual([1, 2, 3]);

    c1.disconnect();
    c2.disconnect();
  });

  it("does not echo the update back to the sender", async () => {
    const c1 = await connect(port);
    c1.emit("join-room", { roomId: "echo-room", username: "Solo" });
    await waitFor(c1, "presence-update");

    let selfReceived = false;
    c1.on("yjs-update", () => { selfReceived = true; });

    c1.emit("yjs-update", { roomId: "echo-room", update: [9, 8, 7] });

    await new Promise((r) => setTimeout(r, 100));
    expect(selfReceived).toBe(false);

    c1.disconnect();
  });
});

describe("cursor-move", () => {
  it("broadcasts cursor-update with position to all room members", async () => {
    const c1 = await connect(port);
    const c2 = await connect(port);

    c1.emit("join-room", { roomId: "cursor-room", username: "Writer" });
    await waitFor(c1, "presence-update");
    c2.emit("join-room", { roomId: "cursor-room", username: "Watcher" });
    await waitFor(c1, "presence-update");

    const cursorPromise = waitFor<{ id: string; username: string; line: number; column: number }[]>(c2, "cursor-update");
    c1.emit("cursor-move", { roomId: "cursor-room", line: 5, column: 12 });

    const cursors = await cursorPromise;
    const writerCursor = cursors.find((u) => u.username === "Writer");
    expect(writerCursor).toBeDefined();
    expect(writerCursor!.line).toBe(5);
    expect(writerCursor!.column).toBe(12);

    c1.disconnect();
    c2.disconnect();
  });
});
