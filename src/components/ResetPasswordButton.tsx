"use client";

import { useState } from "react";

/** On the team tab: a partner types a new password for a member who forgot theirs. */
export default function ResetPasswordButton({
  userId,
  name,
  reset,
}: {
  userId: string;
  name: string;
  reset: (userId: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <span className="flex items-center gap-2">
        {message?.ok && <span className="text-xs text-success">{message.text}</span>}
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-cyan-light"
        >
          איפוס סיסמה
        </button>
      </span>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const result = await reset(userId, password);
          if (!result.ok) {
            setMessage({ ok: false, text: result.error });
            return;
          }
          setMessage({ ok: true, text: `הסיסמה של ${name} עודכנה` });
          setPassword("");
          setOpen(false);
        } catch {
          setMessage({ ok: false, text: "שינוי הסיסמה נכשל, נסה שוב" });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="text"
        autoFocus
        minLength={6}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="סיסמה חדשה (6 תווים לפחות)"
        className="w-48 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand-cyan"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-blue px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "שומר..." : "שמירה"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
        ביטול
      </button>
      {message && !message.ok && <span className="w-full text-xs text-danger">{message.text}</span>}
    </form>
  );
}
