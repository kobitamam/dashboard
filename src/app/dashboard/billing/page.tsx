import { createInvoice, deleteInvoice, markInvoicePaid } from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { loadDashboardData } from "@/lib/db/queries";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { invoiceStatuses } from "@/lib/types";

export default async function BillingPage() {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { invoices } = result.data;

  const sum = (predicate: (status: string) => boolean) =>
    invoices.filter((i) => predicate(i.status)).reduce((total, i) => total + i.amount, 0);

  const paid = sum((s) => s === "שולם");
  const pending = sum((s) => s === "ממתין לתשלום");
  const overdue = sum((s) => s === "באיחור");

  const form = (
    <AddRecord label="+ חשבונית חדשה" action={createInvoice}>
      <Field label="מספר חשבונית" name="invoiceNumber" required placeholder="3023" />
      <Field label="לקוח" name="clientName" required placeholder="שם הלקוח" />
      <Field label="סכום (₪)" name="amount" type="number" min={0} placeholder="0" />
      <Field label="תאריך הפקה" name="issueDate" type="date" />
      <Field label="לתשלום עד" name="dueDate" type="date" />
      <SelectField
        label="סטטוס"
        name="status"
        options={invoiceStatuses}
        defaultValue="ממתין לתשלום"
      />
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="גבייה"
        subtitle="מעקב חשבוניות ותשלומים מול לקוחות"
        action={invoices.length > 0 ? form : undefined}
      />

      {invoices.length === 0 ? (
        <EmptyState
          title="אין עדיין חשבוניות"
          hint="הפק חשבונית ראשונה. חשבונית שתאריך התשלום שלה חלף תסומן אוטומטית כהתראה דחופה."
          action={form}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="שולם" value={formatMoney(paid)} tone="success" />
            <StatCard label="ממתין לתשלום" value={formatMoney(pending)} tone="warning" />
            <StatCard label="בפיגור" value={formatMoney(overdue)} tone="danger" />
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-right text-sm">
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
                  {invoices.map((inv) => {
                    const days = daysUntil(inv.dueDate);
                    const late = inv.status !== "שולם" && days !== null && days < 0;
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0 hover:bg-background/60"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          #{inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {inv.clientName}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {formatMoney(inv.amount)}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(inv.issueDate)}</td>
                        <td className="px-4 py-3">
                          <span className={late ? "font-semibold text-danger" : "text-muted"}>
                            {formatDate(inv.dueDate)}
                            {late && ` (${Math.abs(days)} ימי איחור)`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {inv.status !== "שולם" && (
                              <form action={markInvoicePaid.bind(null, inv.id)}>
                                <button
                                  type="submit"
                                  className="rounded-lg px-2 py-1 text-xs font-semibold text-success hover:bg-success/10"
                                >
                                  סמן כשולם
                                </button>
                              </form>
                            )}
                            <DeleteButton
                              action={deleteInvoice.bind(null, inv.id)}
                              confirmText={`למחוק את חשבונית ${inv.invoiceNumber}?`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
