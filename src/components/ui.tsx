import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.02] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "blue",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "blue" | "cyan" | "success" | "warning" | "danger";
  icon?: ReactNode;
}) {
  const toneMap: Record<string, string> = {
    blue: "bg-brand-blue text-white",
    cyan: "bg-brand-cyan text-brand-blue-dark",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneMap[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

const statusStyles: Record<string, string> = {
  פעיל: "bg-success/10 text-success",
  "ליד חדש": "bg-brand-cyan-light text-brand-blue",
  סגור: "bg-black/5 text-muted",
  בתהליך: "bg-brand-cyan-light text-brand-blue",
  "ממתין למידע": "bg-warning/10 text-warning",
  דחוף: "bg-danger/10 text-danger",
  הושלם: "bg-success/10 text-success",
  שולם: "bg-success/10 text-success",
  "ממתין לתשלום": "bg-warning/10 text-warning",
  באיחור: "bg-danger/10 text-danger",
  גבוהה: "bg-danger/10 text-danger",
  בינונית: "bg-warning/10 text-warning",
  נמוכה: "bg-black/5 text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        statusStyles[status] ?? "bg-black/5 text-muted"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
      <div
        className="h-full rounded-full bg-gradient-to-l from-brand-cyan to-brand-blue"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
