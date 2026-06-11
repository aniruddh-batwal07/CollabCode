"use client";

import Editor from "@monaco-editor/react";

export default function Home() {
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