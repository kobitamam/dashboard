import Link from "next/link";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-lg font-extrabold text-white shadow-lg shadow-brand-blue/20">
            TA
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm shadow-black/[0.02]">
          {children}
        </div>
      </div>
    </div>
  );
}
