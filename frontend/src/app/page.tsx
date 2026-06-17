"use client";

import { useState, useEffect } from "react";
import * as Y from "yjs";

import { socket } from "@/lib/socket";
import { ydoc, ytext } from "@/lib/collaboration";

import RoomControls from "@/components/RoomControls";
import CodeEditor from "@/components/CodeEditor";

import { useSocket } from "@/hooks/useSocket";

export default function Home() {
  const [roomId, setRoomId] =
    useState("room-1");

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
    }
  );

  const joinRoom = () => {
    socket.emit("join-room", roomId);
  };

  const handleEditorMount = async (
    editor: any,
    monaco: any
  ) => {
    const model = editor.getModel();

    if (!model) return;

    const { MonacoBinding } = await import("y-monaco");

    new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      null
    );
  };

  return (
    <main className="h-screen flex flex-col">
      <RoomControls
        roomId={roomId}
        setRoomId={setRoomId}
        joinRoom={joinRoom}
      />

      <CodeEditor
        onMount={handleEditorMount}
      />
    </main>
  );
}