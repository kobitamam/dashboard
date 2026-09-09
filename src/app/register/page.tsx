"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import AuthCard from "@/components/AuthCard";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "אירעה שגיאה, נסה שוב");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("ההרשמה הצליחה, אך ההתחברות נכשלה. נסה להתחבר דרך מסך הכניסה");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard title="הרשמה ל-TA-Estate" subtitle="פתח חשבון חדש למשרד שלך">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">שם מלא</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="תמאם אברהם"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">אימייל</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">סיסמה</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "יוצר חשבון..." : "הרשמה"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        יש לך כבר חשבון?{" "}
        <Link href="/login" className="font-semibold text-brand-blue hover:underline">
          כניסה
        </Link>
      </p>
    </AuthCard>
  );
}
