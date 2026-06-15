"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

export default function Home() {
  const [roomId, setRoomId] =
    useState("room-1");

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState<string[]>([]);

  useEffect(() => {
    socket.on(
      "receive-message",
      (message: string) => {
        setMessages((prev) => [
          ...prev,
          message,
        ]);
      }
    );

    return () => {
      socket.off("receive-message");
    };
  }, []);

  const joinRoom = () => {
    socket.emit("join-room", roomId);

    console.log(
      `Joined room: ${roomId}`
    );
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", {
      roomId,
      message,
    });

    setMessage("");
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Room Test
      </h1>

      <div className="mb-4">
        <input
          className="border p-2 mr-2"
          value={roomId}
          onChange={(e) =>
            setRoomId(e.target.value)
          }
        />

        <button
          onClick={joinRoom}
          className="border px-4 py-2"
        >
          Join Room
        </button>
      </div>

      <div className="mb-4">
        <input
          className="border p-2 mr-2"
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
        />

        <button
          onClick={sendMessage}
          className="border px-4 py-2"
        >
          Send
        </button>
      </div>

      <div>
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
    </main>
  );
}