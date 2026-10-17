"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadFileToOneDrive } from "@/lib/onedrive-upload-client";
import type { Attachment, UploadTarget } from "@/lib/types";

/** The signed quote: one file, saved to OneDrive (and moved to the case folder on approval). */
export default function QuoteFileSlot({
  quoteId,
  label,
  file,
  oneDriveConnected,
  startUpload,
}: {
  quoteId: string;
  label: string;
  file: Attachment | null;
  oneDriveConnected: boolean;
  startUpload: (
    target: UploadTarget,
    fileName: string,
    contentType: string,
    size: number,
  ) => Promise<{ ok: true; token: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(selected: File) {
    setError(null);
    setUploading(true);
    try {
      await uploadFileToOneDrive(selected, { kind: "quote", quoteId }, startUpload);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההעלאה נכשלה, נסה שוב");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5 text-[11px]">
      <span className="shrink-0 font-semibold text-muted">{label}</span>
      {file?.webUrl ? (
        <a
          href={file.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-right font-medium text-brand-blue hover:underline"
          title={file.fileName}
        >
          📎 {file.fileName}
        </a>
      ) : (
        <span className={`flex-1 text-right ${error ? "text-danger" : "text-muted"}`}>
          {error ?? "לא הועלה קובץ"}
        </span>
      )}
      {oneDriveConnected ? (
        <label className="shrink-0 cursor-pointer font-bold text-brand-blue hover:underline">
          {uploading ? "מעלה..." : file ? "החלפה" : "+ העלאה"}
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />
        </label>
      ) : (
        <span className="shrink-0 text-warning">OneDrive לא מחובר</span>
      )}
    </div>
  );
}
