import { Card, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { cases, type CaseStatus } from "@/lib/mock-data";

const columns: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "הושלם"];

export default function CasesPage() {
  return (
    <div>
      <PageHeader
        title="מעקב תיקים"
        subtitle={`${cases.length} תיקים במערכת · ${cases.filter((c) => c.status === "דחוף").length} דחופים`}
        action={
          <button className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
            + תיק חדש
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((status) => {
          const items = cases.filter((c) => c.status === status);
          return (
            <div key={status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <StatusBadge status={status} />
                <span className="text-xs text-muted">{items.length} תיקים</span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted">{c.caseNumber}</span>
                      <span className="text-xs text-muted">{c.dueDate}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{c.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted">{c.address}</p>
                    <p className="mt-2 text-xs font-medium text-brand-blue">{c.type}</p>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span>התקדמות</span>
                        <span>{c.progress}%</span>
                      </div>
                      <ProgressBar value={c.progress} />
                    </div>
                  </Card>
                ))}
                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    אין תיקים בסטטוס זה
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
