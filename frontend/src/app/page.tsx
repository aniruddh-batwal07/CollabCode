"use client";

import { useState, useEffect } from "react";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/yjs";

import RoomControls from "@/components/RoomControls";
import CodeEditor from "@/components/CodeEditor";

import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const [roomId, setRoomId] =
    useState("room-1");

  const [code, setCode] =
    useState("// Start coding...");

  useEffect(() => {
    const updateHandler = (
      update: Uint8Array
    ) => {
      socket.emit("yjs-update", {
        roomId,
        update: Array.from(update),
      });
    };

    ydoc.on("update", updateHandler);

    return () => {
      ydoc.off("update", updateHandler);
    };
  }, [roomId]);

  useSocket(
    "yjs-update",
    (update: number[]) => {
      Y.applyUpdate(
        ydoc,
        new Uint8Array(update)
      );

      setCode(ytext.toString());
    }
  );

  const joinRoom = () => {
    socket.emit("join-room", roomId);
  };

  const handleCodeChange = (
    value: string | undefined
  ) => {
    const updatedCode = value || "";

    ytext.delete(
      0,
      ytext.length
    );

    ytext.insert(
      0,
      updatedCode
    );

    setCode(updatedCode);
  };

  return (
    <main className="h-screen flex flex-col">
      <RoomControls
        roomId={roomId}
        setRoomId={setRoomId}
        joinRoom={joinRoom}
      />

      <CodeEditor
        code={code}
        onChange={handleCodeChange}
      />
    </main>
  );
}