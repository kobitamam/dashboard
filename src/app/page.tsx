import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-6 py-5 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-lg font-extrabold text-white shadow-lg shadow-brand-blue/20">
            TA
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-foreground">TA-Estate</p>
            <p className="text-xs text-muted">שמאות מקרקעין</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-cyan-light"
          >
            כניסה
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            הרשמה
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-blue text-3xl font-extrabold text-white shadow-lg shadow-brand-blue/20">
            TA
          </div>
          <h1 className="mt-5 text-3xl font-extrabold text-foreground">TA-Estate</h1>
          <p className="mt-1.5 text-sm text-muted">שמאות מקרקעין</p>

          <Link
            href="/login"
            className="mt-8 rounded-xl bg-brand-blue px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:opacity-90"
          >
            כניסה למערכת
          </Link>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted lg:px-16">
        TA-Estate © {new Date().getFullYear()} · תמם אברהם, שמאי מקרקעין מוסמך
      </footer>
    </div>
  );
}
