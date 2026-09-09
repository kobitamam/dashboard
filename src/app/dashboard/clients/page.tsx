import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { clients } from "@/lib/mock-data";

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle={`${clients.length} לקוחות במערכת · ${clients.filter((c) => c.status === "פעיל").length} פעילים`}
        action={
          <button className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
            + לקוח חדש
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs text-muted">
                <th className="px-4 py-3 font-medium">לקוח</th>
                <th className="px-4 py-3 font-medium">סוג נכס</th>
                <th className="px-4 py-3 font-medium">סטטוס</th>
                <th className="px-4 py-3 font-medium">תיקים פתוחים</th>
                <th className="px-4 py-3 font-medium">סה&quot;כ חויב</th>
                <th className="px-4 py-3 font-medium">קשר אחרון</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan-light text-xs font-bold text-brand-blue">
                        {c.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{c.name}</p>
                        <p className="truncate text-xs text-muted">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{c.propertyType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{c.openCases}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    ₪{c.totalBilled.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.lastContact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
