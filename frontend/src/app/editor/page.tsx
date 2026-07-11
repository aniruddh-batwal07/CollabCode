import { Suspense } from "react";
import EditorPage from "./EditorPage";

export default function EditorRoute() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-slate-500 text-sm">
        Loading editor…
      </div>
    }>
      <EditorPage />
    </Suspense>
  );
}
