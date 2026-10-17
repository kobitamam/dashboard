"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Rename or delete the types the office added. The built-in types are not listed
 * here, so they can't be changed. Errors come back as data (production masks thrown ones).
 */
export default function TypeManager({
  title,
  types,
  deleteNote,
  rename,
  remove,
}: {
  title: string;
  types: string[];
  deleteNote: string;
  rename: (oldName: string, newName: string) => Promise<Result>;
  remove: (name: string) => Promise<Result>;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(name: string, action: () => Promise<Result>) {
    setError(null);
    setBusy(name);
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        setDrafts((current) => {
          const next = { ...current };
          delete next[name];
          return next;
        });
        router.refresh();
      }
    } catch {
      setError("הפעולה נכשלה, נסה שוב");
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{title}</summary>
      {types.length === 0 ? (
        <p className="mt-3 text-xs text-muted">עדיין לא נוספו סוגים משלך. סוגים מובנים אי אפשר לשנות.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {types.map((name) => {
            const draft = drafts[name] ?? name;
            return (
              <div key={name} className="flex flex-wrap items-center gap-2">
                <input
                  value={draft}
                  maxLength={60}
                  onChange={(e) => setDrafts((current) => ({ ...current, [name]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand-cyan"
                />
                <button
                  type="button"
                  disabled={busy === name || draft.trim() === name || !draft.trim()}
                  onClick={() => run(name, () => rename(name, draft))}
                  className="rounded-lg bg-brand-cyan-light px-3 py-1.5 text-xs font-bold text-brand-blue hover:opacity-80 disabled:opacity-40"
                >
                  שמירת שם
                </button>
                <button
                  type="button"
                  disabled={busy === name}
                  onClick={() => {
                    if (confirm(`למחוק את הסוג "${name}"? ${deleteNote}`)) run(name, () => remove(name));
                  }}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-40"
                >
                  מחיקה
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
    </details>
  );
}
