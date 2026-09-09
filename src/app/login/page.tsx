"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import AuthCard from "@/components/AuthCard";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

// A failed sign-in means either wrong credentials or a misconfigured server,
// and Auth.js reports both identically. Ask the server which one it was.
async function describeFailure() {
  try {
    const res = await fetch("/api/health");
    const health = await res.json();
    if (!health.authSecretConfigured) {
      return "תצורת השרת חסרה: לא הוגדר AUTH_SECRET. פנה למנהל המערכת.";
    }
    if (!health.mongoUriConfigured) {
      return "תצורת השרת חסרה: לא הוגדר MONGODB_URI. פנה למנהל המערכת.";
    }
    if (health.database_connection !== "ok") {
      return "אין כרגע חיבור למסד הנתונים. פנה למנהל המערכת.";
    }
  } catch {
    return "השרת אינו זמין כרגע, נסה שוב מאוחר יותר";
  }
  return "אימייל או סיסמה שגויים";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    }).catch(() => ({ error: "RequestFailed" }));

    setLoading(false);

    if (result?.error) {
      setError(await describeFailure());
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <AuthCard title="כניסה למערכת" subtitle="התחבר לחשבון TA-Estate שלך">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        אין לך חשבון?{" "}
        <Link href="/register" className="font-semibold text-brand-blue hover:underline">
          הרשמה
        </Link>
      </p>
    </AuthCard>
  );
}
