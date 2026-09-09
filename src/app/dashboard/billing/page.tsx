import { Card, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { invoices } from "@/lib/mock-data";

export default function BillingPage() {
  const paid = invoices.filter((i) => i.status === "שולם").reduce((s, i) => s + i.amount, 0);
  const pending = invoices
    .filter((i) => i.status === "ממתין לתשלום")
    .reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "באיחור").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <PageHeader
        title="גבייה"
        subtitle="מעקב חשבוניות ותשלומים מול לקוחות"
        action={
          <button className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
            + חשבונית חדשה
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="שולם החודש" value={`₪${paid.toLocaleString()}`} tone="success" />
        <StatCard label="ממתין לתשלום" value={`₪${pending.toLocaleString()}`} tone="warning" />
        <StatCard label="בפיגור" value={`₪${overdue.toLocaleString()}`} tone="danger" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs text-muted">
                <th className="px-4 py-3 font-medium">חשבונית</th>
                <th className="px-4 py-3 font-medium">לקוח</th>
                <th className="px-4 py-3 font-medium">סכום</th>
                <th className="px-4 py-3 font-medium">הופקה</th>
                <th className="px-4 py-3 font-medium">לתשלום עד</th>
                <th className="px-4 py-3 font-medium">סטטוס</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted">#{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{inv.clientName}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    ₪{inv.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted">{inv.issueDate}</td>
                  <td className="px-4 py-3 text-muted">{inv.dueDate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3">
                    {inv.status !== "שולם" && (
                      <button className="text-xs font-semibold text-brand-blue hover:underline">
                        שלח תזכורת
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
