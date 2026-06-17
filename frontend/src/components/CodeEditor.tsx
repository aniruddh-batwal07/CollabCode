"use client";

import Editor from "@monaco-editor/react";

interface Props {
  onMount: (
    editor: any,
    monaco: any
  ) => void;
}

export default function CodeEditor({
  onMount,
}: Props) {
  return (
    <Editor
      height="100%"
      language="javascript"
      onMount={onMount}
    />
  );
}