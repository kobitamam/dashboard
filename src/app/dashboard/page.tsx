import Link from "next/link";
import { auth } from "@/auth";
import { loadDemoData } from "@/app/dashboard/actions";
import { DataUnavailable, SubmitButton } from "@/components/form";
import { Card, PageHeader, ProgressBar, StatCard, StatusBadge } from "@/components/ui";
import { deriveAlerts } from "@/lib/alerts";
import { feeTotals } from "@/lib/fees";
import { caseDeadlines } from "@/lib/deadlines";
import { loadDashboardData } from "@/lib/db/queries";
import { daysUntil, formatDate, formatMoney, formatTime, isSameDay } from "@/lib/format";

export default async function Dashboard() {
  const session = await auth();
  const firstName = (session?.user?.name || "שלך").split(" ")[0];
  const isPartner = session?.user?.role === "partner";

  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { clients, cases, events } = result.data;
  const alerts = deriveAlerts({ cases, events });
  const isEmpty =
    clients.length === 0 && cases.length === 0 && events.length === 0;

  // What can be collected right now, from the fees of the cases (partners only: an
  // employee's cases carry no fee data).
  const billing = cases.map((c) => feeTotals(c.fee, c.status === "הושלם"));
  const owedNow = billing.reduce((sum, b) => sum + b.balanceDue, 0);
  const casesToCollect = billing.filter((b) => b.balanceDue > 0).length;
  const activeClients = clients.filter((c) => c.status === "פעיל").length;
  const openCases = cases.filter((c) => c.status !== "הושלם");
  const urgentCases = openCases.filter((c) => c.status === "דחוף");

  const today = new Date();
  const todayEvents = events.filter((e) => isSameDay(e.start, today));
  // Each open case with its nearest deadline (a betterment-levy case may have three).
  const nextDeadlines = openCases
    .flatMap((c) => {
      const [nearest] = caseDeadlines(c);
      return nearest ? [{ case: c, deadline: nearest }] : [];
    })
    .sort((a, b) => a.deadline.date.localeCompare(b.deadline.date))
    .slice(0, 4);

  if (isEmpty) {
    return (
      <div>
        <PageHeader title={`ברוך הבא, ${firstName} 👋`} subtitle="הדשבורד שלך עדיין ריק" />
        <Card className="p-10 text-center">
          <p className="text-lg font-bold text-foreground">בוא נתחיל</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {isPartner
              ? "אפשר להוסיף לקוחות ותיקים ידנית מהתפריט בצד, או לטעון נתוני דוגמה כדי לראות איך המערכת נראית מלאה. תמיד אפשר למחוק אותם אחר כך."
              : "אפשר להוסיף לקוחות ותיקים ידנית מהתפריט בצד."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {isPartner && (
              <form action={loadDemoData}>
                <SubmitButton>טען נתוני דוגמה</SubmitButton>
              </form>
            )}
            <Link
              href="/dashboard/clients"
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background"
            >
              הוסף לקוח ראשון
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`בוקר טוב, ${firstName} 👋`}
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
          value={String(openCases.length)}
          hint={`${urgentCases.length} תיקים דחופים`}
          tone="cyan"
          icon={<FolderMini />}
        />
        {isPartner && (
          <>
            <StatCard
              label="לגבייה כעת"
              value={formatMoney(owedNow)}
              hint="שכר טרחה שהגיע מועד גבייתו"
              tone="danger"
              icon={<AlertMini />}
            />
            <StatCard
              label="תיקים לגבייה"
              value={String(casesToCollect)}
              hint="עם יתרה שממתינה לתשלום"
              tone="warning"
              icon={<WalletMini />}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">התיקים הקרובים לדדליין</h2>
            <Link
              href="/dashboard/cases"
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              כל התיקים ←
            </Link>
          </div>
          {nextDeadlines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין תיקים פתוחים עם תאריך יעד</p>
          ) : (
            <div className="space-y-3">
              {nextDeadlines.map(({ case: c, deadline }) => {
                const days = daysUntil(deadline.date);
                return (
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
                      {c.address && <p className="truncate text-xs text-muted">{c.address}</p>}
                    </div>
                    <div className="w-full sm:w-44">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted">{c.progress}%</span>
                        <span className={days !== null && days < 0 ? "font-semibold text-danger" : "text-muted"}>
                          {deadline.key !== "due" && `${deadline.label.split(" - ")[0]} · `}
                          {formatDate(deadline.date)}
                        </span>
                      </div>
                      <ProgressBar value={c.progress} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">התראות חכמות</h2>
            <Link
              href="/dashboard/alerts"
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              הכל ←
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין התראות פתוחות</p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex gap-3 rounded-xl border border-border p-3">
                  <div className="mt-0.5">
                    <StatusBadge status={a.severity} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">היומן שלך היום</h2>
            <Link
              href="/dashboard/calendar"
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              יומן מלא ←
            </Link>
          </div>
          {todayEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין פגישות מתוכננות להיום</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {todayEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-cyan-light text-brand-blue">
                    <span className="text-sm font-bold">{e.allDay ? "כל היום" : formatTime(e.start)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                    <p className="text-xs text-muted">
                      {e.type}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
