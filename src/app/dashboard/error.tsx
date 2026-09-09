"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <p className="text-lg font-bold text-foreground">לא הצלחנו לטעון את הנתונים</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        ברוב המקרים זו בעיית חיבור למסד הנתונים. אפשר לבדוק מה בדיוק חסר בכתובת{" "}
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">/api/health</code>
        , ולוודא ש-<code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">MONGODB_URI</code>{" "}
        מוגדר ושכתובת ה-IP של השרת מאושרת ב-MongoDB Atlas.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        נסה שוב
      </button>
    </div>
  );
}
