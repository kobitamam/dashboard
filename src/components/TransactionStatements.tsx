"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BettermentStatementForm from "@/components/BettermentStatementForm";
import type { BettermentStatementInput } from "@/lib/betterment-statement";
import type { TransactionStatement } from "@/lib/types";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** A case's transaction statements (חשבון עסקה) on the billing tab: open each in Word, or produce a new one. */
export default function TransactionStatements({
  caseId,
  statements,
  canCreate,
  oneDriveConnected,
  create,
  getWordUri,
  betterment,
}: {
  caseId: string;
  statements: TransactionStatement[];
  canCreate: boolean; // something can be collected now
  oneDriveConnected: boolean;
  create: (caseId: string) => Promise<Result<{ url: string; number: number }>>;
  getWordUri: (caseId: string, number: number) => Promise<Result<{ uri: string }>>;
  // A betterment-levy case also gets the closing statement (גמר חשבון) from the figures typed in a form.
  betterment?: {
    defaults: BettermentStatementInput;
    create: (caseId: string, input: BettermentStatementInput) => Promise<Result<{ url: string; number: number }>>;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hands the file to the Word desktop app through its ms-word: link.
  async function openInWord(number: number) {
    const result = await getWordUri(caseId, number);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.assign(result.uri);
  }

  async function run(task: () => Promise<void>, failure: string) {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = () =>
    run(async () => {
      const created = await create(caseId);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      router.refresh();
      await openInWord(created.number);
    }, "הפקת חשבון העסקה נכשלה, נסה שוב");

  const handleBetterment = (input: BettermentStatementInput) =>
    run(async () => {
      if (!betterment) return;
      const created = await betterment.create(caseId, input);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      setFormOpen(false);
      router.refresh();
      await openInWord(created.number);
    }, "הפקת גמר החשבון נכשלה, נסה שוב");

  return (
    <div className="space-y-1 text-xs">
      {statements.map((s) => (
        <div key={s.number} className="flex items-center justify-end gap-2 whitespace-nowrap">
          <span className="text-muted">חשבון עסקה {s.number}</span>
          <a href={s.webUrl} target="_blank" rel="noopener noreferrer" className="text-muted hover:underline">
            בדפדפן
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => openInWord(s.number), "לא הצלחנו לפתוח ב-Word, נסה שוב")}
            className="font-semibold text-brand-blue hover:underline disabled:opacity-60"
          >
            📄 Word
          </button>
        </div>
      ))}
      {canCreate &&
        (oneDriveConnected ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="font-semibold text-brand-blue hover:underline disabled:opacity-60"
          >
            {busy ? "מפיק..." : "🧾 הפק חשבון עסקה"}
          </button>
        ) : (
          <span className="text-warning">OneDrive לא מחובר</span>
        ))}
      {betterment && oneDriveConnected && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setFormOpen(true);
          }}
          className="block font-semibold text-brand-blue hover:underline disabled:opacity-60"
        >
          🧾 הפק גמר חשבון
        </button>
      )}
      {error && !formOpen && <p className="text-danger">{error}</p>}
      {formOpen && betterment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
          <div className="w-full max-w-6xl">
            <BettermentStatementForm
              defaults={betterment.defaults}
              busy={busy}
              onSubmit={handleBetterment}
              onCancel={() => setFormOpen(false)}
            />
            {error && <p className="mt-2 rounded-lg bg-surface p-2 text-danger">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
