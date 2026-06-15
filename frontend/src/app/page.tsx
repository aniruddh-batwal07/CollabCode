"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { socket } from "@/lib/socket";

export default function Home() {
  const [roomId, setRoomId] =
    useState("room-1");

  const [code, setCode] = useState(
    "// Start coding..."
  );

  useEffect(() => {
    socket.on(
      "receive-code",
      (incomingCode: string) => {
        setCode(incomingCode);
      }
    );

    return () => {
      socket.off("receive-code");
    };
  }, []);

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
      <div className="p-4 border-b">
        <input
          className="border p-2 mr-2"
          value={roomId}
          onChange={(e) =>
            setRoomId(e.target.value)
          }
        />

        <button
          className="border px-4 py-2"
          onClick={joinRoom}
        >
          Join Room
        </button>
      </div>

      <Editor
        height="100%"
        language="javascript"
        value={code}
        onChange={handleCodeChange}
      />
    </main>
  );
}