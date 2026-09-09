import { DataUnavailable, EmptyState } from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { deriveAlerts } from "@/lib/alerts";
import { loadDashboardData } from "@/lib/db/queries";

const categoryIcon: Record<string, string> = {
  תשלום: "💳",
  תיק: "📁",
  פגישה: "📅",
};

export default async function AlertsPage() {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { cases, invoices, events } = result.data;
  const alerts = deriveAlerts({ cases, invoices, events });

  return (
    <div>
      <PageHeader
        title="התראות חכמות"
        subtitle="נגזרות אוטומטית מהתיקים, החשבוניות והפגישות שלך - אין צורך להזין אותן"
      />

      {alerts.length === 0 ? (
        <EmptyState
          title="הכל תחת שליטה"
          hint="אין כרגע חשבוניות באיחור, תיקים לקראת דדליין או פגישות להיום."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan-light text-lg">
                {categoryIcon[a.category]}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <StatusBadge status={a.severity} />
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted">{a.description}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
