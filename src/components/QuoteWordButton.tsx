"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export default function QuoteWordButton({
  quoteId,
  url,
  oneDriveConnected,
  createDocument,
  getWordUri,
}: {
  quoteId: string;
  url: string | null;
  oneDriveConnected: boolean;
  createDocument: (quoteId: string) => Promise<Result<{ url: string }>>;
  getWordUri: (quoteId: string) => Promise<Result<{ uri: string }>>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hands the file to the Word desktop app through its ms-word: link.
  async function openInWord() {
    const result = await getWordUri(quoteId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = result.uri;
  }

  async function handleOpen() {
    setError(null);
    setBusy(true);
    try {
      await openInWord();
    } catch {
      setError("לא הצלחנו לפתוח ב-Word, נסה שוב");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      const created = await createDocument(quoteId);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      router.refresh();
      await openInWord();
    } catch {
      setError("יצירת הקובץ נכשלה, נסה שוב");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-background px-2.5 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 font-semibold text-muted">הצעה (Word)</span>
        {url ? (
          <span className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:underline"
            >
              בדפדפן
            </a>
            <button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              className="font-bold text-brand-blue hover:underline disabled:opacity-60"
            >
              {busy ? "פותח..." : "📄 פתח ב-Word"}
            </button>
          </span>
        ) : !oneDriveConnected ? (
          <span className="flex-1 text-right text-warning">OneDrive לא מחובר</span>
        ) : (
          <>
            <span className="flex-1 text-right text-muted">טרם נוצר</span>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="shrink-0 font-bold text-brand-blue hover:underline disabled:opacity-60"
            >
              {busy ? "יוצר..." : "+ צור"}
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-danger">{error}</p>}
    </div>
  );
}
