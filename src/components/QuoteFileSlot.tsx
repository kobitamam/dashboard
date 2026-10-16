"use client";

import { useRef, useState } from "react";
import type { Attachment } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

export default function QuoteFileSlot({
  quoteId,
  slot,
  label,
  file,
  requestUploadUrl,
  confirmUpload,
  requestDownloadUrl,
  uploadsEnabled = true,
}: {
  quoteId: string;
  slot: "draftFile" | "signedFile";
  label: string;
  file: Attachment | null;
  uploadsEnabled?: boolean;
  requestUploadUrl: (
    quoteId: string,
    slot: "draftFile" | "signedFile",
    fileName: string,
    contentType: string,
    size: number,
  ) => Promise<{ url: string; key: string }>;
  confirmUpload: (
    quoteId: string,
    slot: "draftFile" | "signedFile",
    file: { key: string; fileName: string; contentType: string },
  ) => Promise<void>;
  requestDownloadUrl: (quoteId: string, slot: "draftFile" | "signedFile") => Promise<string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(selected: File) {
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError(`הקובץ חורג מ-${MAX_BYTES / 1024 / 1024}MB`);
      return;
    }

    setUploading(true);
    try {
      const { url, key } = await requestUploadUrl(
        quoteId,
        slot,
        selected.name,
        selected.type,
        selected.size,
      );
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": selected.type || "application/octet-stream" },
        body: selected,
      });
      if (!res.ok) throw new Error("ההעלאה לאחסון נכשלה");

      await confirmUpload(quoteId, slot, {
        key,
        fileName: selected.name,
        contentType: selected.type,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההעלאה נכשלה, נסה שוב");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleDownload() {
    setError(null);
    try {
      const url = await requestDownloadUrl(quoteId, slot);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן להוריד את הקובץ");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5 text-[11px]">
      <span className="shrink-0 font-semibold text-muted">{label}</span>
      {file ? (
        <button
          type="button"
          onClick={handleDownload}
          className="min-w-0 flex-1 truncate text-right font-medium text-brand-blue hover:underline"
          title={file.fileName}
        >
          📎 {file.fileName}
        </button>
      ) : (
        <span className="flex-1 text-right text-muted">לא הועלה קובץ</span>
      )}
      {uploadsEnabled ? (
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
        <span className="shrink-0 text-warning">אחסון קבצים לא מוגדר</span>
      )}
      {error && <span className="shrink-0 text-danger">{error}</span>}
    </div>
  );
}
