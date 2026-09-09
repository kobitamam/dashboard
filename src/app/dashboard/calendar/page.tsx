import { Card, PageHeader } from "@/components/ui";
import { recentEmails, todayEvents } from "@/lib/mock-data";

export default function CalendarPage() {
  return (
    <div>
      <PageHeader
        title="יומן ומייל"
        subtitle="סנכרון אוטומטי עם Google Calendar / Outlook ותיבת המייל"
        action={
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Google Calendar מחובר
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Gmail מחובר
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">לוח היום</h2>
          <div className="space-y-3">
            {todayEvents.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <span className="text-sm font-bold text-brand-blue">{e.time}</span>
                  <span className="mt-1 h-full w-px bg-border" />
                </div>
                <div className="flex-1 rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{e.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {e.type} · {e.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">תיבת דואר נכנס</h2>
          <div className="space-y-3">
            {recentEmails.map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan-light text-xs font-bold text-brand-blue">
                  {m.from.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{m.from}</p>
                    <span className="shrink-0 text-[11px] text-muted">{m.time}</span>
                  </div>
                  <p className="truncate text-sm text-foreground/80">{m.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{m.snippet}</p>
                  {m.linkedTo && (
                    <span className="mt-2 inline-block rounded-full bg-brand-cyan-light px-2 py-0.5 text-[11px] font-medium text-brand-blue">
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
