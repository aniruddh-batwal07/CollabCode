"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    socket.on("receive-message", (message: string) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("receive-message");
    };
  }, []);

  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", message);

    setMessage("");
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        WebSocket Test
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          className="border p-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message"
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
          <div key={index}>
            {msg}
          </div>
        ))}
      </div>
    </main>
  );
}