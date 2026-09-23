"use client";

import { useRef, useState, useTransition } from "react";
import type { Attachment } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CaseAttachments({
  caseId,
  attachments,
  requestUploadUrl,
  confirmUpload,
  requestDownloadUrl,
  deleteAttachment,
}: {
  caseId: string;
  attachments: Attachment[];
  requestUploadUrl: (
    caseId: string,
    fileName: string,
    contentType: string,
    size: number,
  ) => Promise<{ url: string; key: string }>;
  confirmUpload: (
    caseId: string,
    attachment: { key: string; fileName: string; contentType: string },
  ) => Promise<void>;
  requestDownloadUrl: (caseId: string, key: string) => Promise<string>;
  deleteAttachment: (caseId: string, key: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`הקובץ חורג מ-${MAX_BYTES / 1024 / 1024}MB`);
      return;
    }

    setUploading(true);
    try {
      const { url, key } = await requestUploadUrl(
        caseId,
        file.name,
        file.type,
        file.size,
      );

      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("ההעלאה לאחסון נכשלה");

      await confirmUpload(caseId, {
        key,
        fileName: file.name,
        contentType: file.type,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההעלאה נכשלה, נסה שוב");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleDownload(key: string) {
    setError(null);
    try {
      const url = await requestDownloadUrl(caseId, key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן להוריד את הקובץ");
    }
  }

  function handleDelete(key: string) {
    if (!confirm("למחוק את הקובץ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAttachment(caseId, key);
      } catch (err) {
        setError(err instanceof Error ? err.message : "המחיקה נכשלה");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">
          קבצים ({attachments.length})
        </span>
        <label className="cursor-pointer text-[11px] font-bold text-brand-blue hover:underline">
          {uploading ? "מעלה..." : "+ הוספת קובץ"}
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {error && <p className="mt-1.5 text-[11px] text-danger">{error}</p>}

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li
              key={a.key}
              className="flex items-center justify-between gap-2 rounded-lg bg-background px-2 py-1.5 text-[11px]"
            >
              <button
                type="button"
                onClick={() => handleDownload(a.key)}
                className="min-w-0 flex-1 truncate text-right font-medium text-foreground hover:text-brand-blue"
                title={a.fileName}
              >
                📎 {a.fileName}
              </button>
              <span className="shrink-0 text-muted">{formatSize(a.size)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDelete(a.key)}
                className="shrink-0 text-danger hover:opacity-70 disabled:opacity-40"
                aria-label="מחיקה"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
