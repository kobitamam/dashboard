"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteMemberForm({
  inviteMember,
}: {
  inviteMember: (form: {
    name: string;
    email: string;
    password: string;
    role: "partner" | "employee";
  }) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"partner" | "employee">("employee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        + הוספת שותף או עובד
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await inviteMember({ name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה, נסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">תפקיד</span>
          <select
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
            value={role}
            onChange={(e) => setRole(e.target.value as "partner" | "employee")}
          >
            <option value="employee">עובד</option>
            <option value="partner">שותף</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">שם מלא</span>
          <input
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">אימייל</span>
          <input
            type="email"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">סיסמה זמנית</span>
          <input
            type="password"
            minLength={6}
            placeholder="לפחות 6 תווים"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>

      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <p className="mt-3 text-xs text-muted">
        שותף רואה הכול: הצעות מחיר, גבייה, שכר טרחה וניהול הצוות. עובד לא. מסרו את האימייל והסיסמה בדרך בטוחה - הוא יתחבר איתם למערכת. שינוי סיסמה עצמאי עוד לא קיים במערכת.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "יוצר..." : "יצירת חשבון"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-background"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
