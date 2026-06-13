"use client";

import { useEffect } from "react";
import Editor from "@monaco-editor/react";
import { socket } from "@/lib/socket";

export default function Home() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return (
    <main className="h-screen">
      <Editor
        height="100%"
        defaultLanguage="javascript"
        defaultValue="// Start coding..."
      />
    </main>
  );
}