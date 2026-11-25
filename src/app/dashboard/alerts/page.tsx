import CaseSummary from "@/components/CaseSummary";
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
  if (!result.ok) return <DataUnavailable reason={result.reason} />;
  const { cases, events } = result.data;
  const alerts = deriveAlerts({ cases, events });
  const caseById = new Map(cases.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="התראות חכמות"
        subtitle="נגזרות אוטומטית מהתיקים והפגישות שלך - אין צורך להזין אותן"
      />

      {alerts.length === 0 ? (
        <EmptyState
          title="הכל תחת שליטה"
          hint="אין כרגע תיקים לקראת דדליין, תיקים שממתינים לגבייה או פגישות להיום."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan-light text-lg">
                {categoryIcon[a.category]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <StatusBadge status={a.severity} />
                </div>
                {/* With the case's box below, the line says only what the alert is about. */}
                <p className="mt-1 max-w-2xl text-sm text-muted">
                  {a.caseId && caseById.get(a.caseId) ? (a.caseNote ?? a.description) : a.description}
                </p>
                {/* The case it is about, as on its folded card in the cases tab (a click opens the case). */}
                {a.caseId && caseById.get(a.caseId) && (
                  <div className="mt-2 max-w-md">
                    <CaseSummary c={caseById.get(a.caseId)!} />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
