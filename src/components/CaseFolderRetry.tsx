"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shown on a case whose OneDrive folder is missing: creates it and says why if that fails. */
export default function CaseFolderRetry({
  caseId,
  retry,
  prompt = "📁 אין תיקיית OneDrive",
  action = "צור תיקייה",
}: {
  caseId: string;
  retry: (
    caseId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  prompt?: string;
  action?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setMessage(null);
    setBusy(true);
    try {
      const result = await retry(caseId);
      if (!result.ok) setMessage(result.error);
      router.refresh();
    } catch {
      setMessage("הפעולה נכשלה, נסה שוב");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-muted">
      {prompt}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="font-bold text-brand-blue hover:underline disabled:opacity-60"
      >
        {busy ? "יוצר..." : action}
      </button>
      {message && <span className="w-full text-danger">{message}</span>}
    </span>
  );
}
