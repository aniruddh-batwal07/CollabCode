import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  code: string;
  onChange: (
    value: string | undefined
  ) => void;
}

export default function CodeEditor({
  code,
  onChange,
}: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language="javascript"
      value={code}
      onChange={onChange}
    />
  );
}