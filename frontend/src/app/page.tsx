"use client";

import { useState } from "react";

import { socket } from "@/lib/socket";

import RoomControls from "@/components/RoomControls";
import CodeEditor from "@/components/CodeEditor";

import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const [roomId, setRoomId] =
    useState("room-1");

  const [code, setCode] =
    useState("// Start coding...");

  useSocket(
    "receive-code",
    (incomingCode: string) => {
      setCode(incomingCode);
    }
  );

  const joinRoom = () => {
    socket.emit("join-room", roomId);
  };

  const handleCodeChange = (
    value: string | undefined
  ) => {
    const updatedCode = value || "";

    setCode(updatedCode);

    socket.emit("code-change", {
      roomId,
      code: updatedCode,
    });
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