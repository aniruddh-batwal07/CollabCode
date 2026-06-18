"use client";

import Editor from "@monaco-editor/react";

interface Props {
  onMount: (
    editor: any,
    monaco: any
  ) => void;
  onCursorMove: (line: number) => void;
}

export default function CodeEditor({
  onMount,
  onCursorMove,
}: Props) {
  return (
    <Editor
      height="100%"
      language="javascript"
      onMount={(editor, monaco) => {
        onMount(editor, monaco);
        editor.onDidChangeCursorPosition(
          (event) => {
            onCursorMove(
              event.position.lineNumber
            );
          }
        );
      }}
    />
  );
}