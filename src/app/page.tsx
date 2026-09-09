import Link from "next/link";
import { Card, PageHeader, ProgressBar, StatCard, StatusBadge } from "@/components/ui";
import {
  alerts,
  cases,
  clients,
  invoices,
  recentEmails,
  todayEvents,
} from "@/lib/mock-data";

export default function Dashboard() {
  const overdueAmount = invoices
    .filter((i) => i.status === "באיחור")
    .reduce((sum, i) => sum + i.amount, 0);
  const pendingAmount = invoices
    .filter((i) => i.status === "ממתין לתשלום")
    .reduce((sum, i) => sum + i.amount, 0);
  const activeClients = clients.filter((c) => c.status === "פעיל").length;
  const openCases = cases.filter((c) => c.status !== "הושלם").length;
  const urgentCases = cases.filter((c) => c.status === "דחוף");

  return (
    <div>
      <PageHeader
        title="בוקר טוב, תמאם 👋"
        subtitle="הנה סיכום המצב במשרד שלך להיום"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="לקוחות פעילים"
          value={String(activeClients)}
          hint={`מתוך ${clients.length} לקוחות במערכת`}
          tone="blue"
          icon={<UsersMini />}
        />
        <StatCard
          label="תיקים פתוחים"
          value={String(openCases)}
          hint={`${urgentCases.length} תיקים דחופים`}
          tone="cyan"
          icon={<FolderMini />}
        />
        <StatCard
          label="חובות בפיגור"
          value={`₪${overdueAmount.toLocaleString()}`}
          hint="דורש טיפול מיידי"
          tone="danger"
          icon={<AlertMini />}
        />
        <StatCard
          label="ממתין לתשלום"
          value={`₪${pendingAmount.toLocaleString()}`}
          hint="בטווח התשלום התקין"
          tone="warning"
          icon={<WalletMini />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">תיקים דחופים</h2>
            <Link href="/cases" className="text-sm font-medium text-brand-blue hover:underline">
              כל התיקים ←
            </Link>
          </div>
          <div className="space-y-3">
            {cases.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{c.caseNumber}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {c.clientName}
                  </p>
                  <p className="truncate text-xs text-muted">{c.address}</p>
                </div>
                <div className="w-full sm:w-40">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span>{c.progress}%</span>
                    <span>יעד: {c.dueDate}</span>
                  </div>
                  <ProgressBar value={c.progress} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">התראות חכמות</h2>
            <Link href="/alerts" className="text-sm font-medium text-brand-blue hover:underline">
              הכל ←
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex gap-3 rounded-xl border border-border p-3">
                <div className="mt-0.5">
                  <StatusBadge status={a.severity} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.description}</p>
                  <p className="mt-1 text-[11px] text-muted">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">היומן שלך היום</h2>
            <Link href="/calendar" className="text-sm font-medium text-brand-blue hover:underline">
              יומן מלא ←
            </Link>
          </div>
          <div className="space-y-3">
            {todayEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-cyan-light text-brand-blue">
                  <span className="text-sm font-bold">{e.time}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                  <p className="text-xs text-muted">{e.type} · {e.location}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">מיילים אחרונים</h2>
            <Link href="/calendar" className="text-sm font-medium text-brand-blue hover:underline">
              תיבת דואר ←
            </Link>
          </div>
          <div className="space-y-3">
            {recentEmails.slice(0, 4).map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    m.unread ? "bg-brand-cyan" : "bg-black/10"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{m.from}</p>
                    <span className="shrink-0 text-[11px] text-muted">{m.time}</span>
                  </div>
                  <p className="truncate text-xs text-foreground/80">{m.subject}</p>
                  {m.linkedTo && (
                    <span className="mt-1 inline-block rounded-full bg-brand-cyan-light px-2 py-0.5 text-[11px] font-medium text-brand-blue">
                      מקושר לתיק {m.linkedTo}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function UsersMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FolderMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l1.6 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17.5V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function AlertMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 4 3 19h18L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.5v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function WalletMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="6.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
