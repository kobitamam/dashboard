"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function QuoteWordButton({
  quoteId,
  url,
  oneDriveConnected,
  createDocument,
}: {
  quoteId: string;
  url: string | null;
  oneDriveConnected: boolean;
  createDocument: (
    quoteId: string,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    // Opened straight from the click, because a window opened after the
    // await below is treated as a popup and blocked.
    const tab = window.open("about:blank", "_blank");
    setCreating(true);
    try {
      const result = await createDocument(quoteId);
      if (!result.ok) {
        tab?.close();
        setError(result.error);
        return;
      }
      if (tab) tab.location.href = result.url;
      router.refresh();
    } catch {
      tab?.close();
      setError("יצירת הקובץ נכשלה, נסה שוב");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-1.5 text-[11px]">
      <span className="shrink-0 font-semibold text-muted">הצעה (Word)</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-right font-bold text-brand-blue hover:underline"
        >
          📄 פתח ב-Word
        </a>
      ) : !oneDriveConnected ? (
        <span className="flex-1 text-right text-warning">OneDrive לא מחובר</span>
      ) : (
        <>
          <span className="flex-1 text-right text-muted">{error ?? "טרם נוצר"}</span>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className={`shrink-0 font-bold hover:underline disabled:opacity-60 ${error ? "text-danger" : "text-brand-blue"}`}
          >
            {creating ? "יוצר..." : "+ צור"}
          </button>
        </>
      )}
    </div>
  );
}
