"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { uploadFileToOneDrive } from "@/lib/onedrive-upload-client";
import type { Attachment, UploadTarget } from "@/lib/types";

function formatSize(bytes: number) {
  if (bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CaseAttachments({
  caseId,
  attachments,
  hasFolder,
  startUpload,
  removeAttachment,
}: {
  caseId: string;
  attachments: Attachment[];
  hasFolder: boolean;
  startUpload: (
    target: UploadTarget,
    fileName: string,
    contentType: string,
    size: number,
  ) => Promise<{ ok: true; token: string } | { ok: false; error: string }>;
  removeAttachment: (caseId: string, key: string) => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      await uploadFileToOneDrive(file, { kind: "case", caseId }, startUpload);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההעלאה נכשלה, נסה שוב");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function handleRemove(key: string) {
    if (!confirm("להסיר את הקובץ מהרשימה? הוא יישאר בתיקיית התיק ב-OneDrive.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeAttachment(caseId, key);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ההסרה נכשלה");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">
          קבצים ({attachments.length})
        </span>
        {hasFolder ? (
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
        ) : (
          <span className="text-[11px] text-warning">אין תיקיית OneDrive לתיק</span>
        )}
      </div>

      {error && <p className="mt-1.5 text-[11px] text-danger">{error}</p>}

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li
              key={a.key}
              className="flex items-center justify-between gap-2 rounded-lg bg-background px-2 py-1.5 text-[11px]"
            >
              {a.webUrl ? (
                <a
                  href={a.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-right font-medium text-foreground hover:text-brand-blue"
                  title={a.fileName}
                >
                  📎 {a.fileName}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-right" title={a.fileName}>
                  📎 {a.fileName}
                </span>
              )}
              <span className="shrink-0 text-muted">{formatSize(a.size)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(a.key)}
                className="shrink-0 text-danger hover:opacity-70 disabled:opacity-40"
                aria-label="הסרה מהרשימה"
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
