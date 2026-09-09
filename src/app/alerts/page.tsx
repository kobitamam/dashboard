import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { alerts } from "@/lib/mock-data";

const categoryIcon: Record<string, string> = {
  תשלום: "💳",
  תיק: "📁",
  פגישה: "📅",
  מסמך: "📄",
};

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        title="התראות חכמות"
        subtitle="המערכת מתריעה אוטומטית על דדליינים, תשלומים ומסמכים חסרים"
      />

      <div className="space-y-3">
        {alerts.map((a) => (
          <Card key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan-light text-lg">
                {categoryIcon[a.category]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <StatusBadge status={a.severity} />
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted">{a.description}</p>
                <p className="mt-1 text-xs text-muted">{a.time}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background">
                דחה
              </button>
              <button className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                טפל עכשיו
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
