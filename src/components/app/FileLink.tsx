import { Paperclip } from "lucide-react";
import { useApp } from "@/lib/app-store";
import type { FileRef } from "@/lib/types";

export function FileLink({ file }: { file: FileRef }) {
  const { getFileUrl } = useApp();
  const open = async () => {
    const url = await getFileUrl(file);
    if (url) window.open(url, "_blank", "noopener");
  };
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-secondary"
    >
      <Paperclip className="size-3.5 text-muted-foreground" /> {file.name}
      <span className="text-muted-foreground">{file.size}</span>
    </button>
  );
}
