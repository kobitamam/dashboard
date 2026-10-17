import Link from "next/link";
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
import { currentRole, loadDashboardData } from "@/lib/db/queries";
import { feeTotals } from "@/lib/fees";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { invoiceStatuses } from "@/lib/types";

export default async function BillingPage() {
  if ((await currentRole()) !== "partner") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        <p className="mt-2 text-sm text-muted">נתוני הגבייה חשופים לשותפים בלבד.</p>
      </div>
    );
  }

  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { invoices, cases } = result.data;

  // A finished case moves to billing: the ones still owed money come first.
  const completed = cases
    .filter((c) => c.status === "הושלם")
    .map((c) => ({ case: c, ...feeTotals(c.fee) }))
    .sort((a, b) => Number(b.balance > 0) - Number(a.balance > 0) || b.balance - a.balance);
  const awaitingCollection = completed.reduce((sum, c) => sum + Math.max(0, c.balance), 0);

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

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold">
            תיקים שהושלמו - לגבייה
            <span className="mr-2 text-sm font-normal text-muted">({completed.length})</span>
          </h2>
          {completed.length > 0 && (
            <span className="text-sm text-muted">
              יתרה לגבייה:{" "}
              <span className="font-bold text-foreground">{formatMoney(awaitingCollection)}</span>
            </span>
          )}
        </div>
        {completed.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            תיק שיסומן כ&quot;הושלם&quot; יופיע כאן אוטומטית.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-xs text-muted">
                  <th className="px-4 py-3 font-medium">תיק</th>
                  <th className="px-4 py-3 font-medium">לקוח</th>
                  <th className="px-4 py-3 font-medium">שכר טרחה</th>
                  <th className="px-4 py-3 font-medium">שולם</th>
                  <th className="px-4 py-3 font-medium">יתרה</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {completed.map(({ case: c, total, paid: paidSoFar, balance }) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{c.caseNumber}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{c.clientName}</td>
                    <td className="px-4 py-3 text-foreground">
                      {c.fee ? formatMoney(total) : <span className="text-warning">לא הוגדר</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoney(paidSoFar)}</td>
                    <td className="px-4 py-3">
                      {!c.fee ? (
                        <span className="text-muted">—</span>
                      ) : balance > 0 ? (
                        <span className="font-semibold text-danger">{formatMoney(balance)}</span>
                      ) : (
                        <span className="font-semibold text-success">שולם במלואו</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link
                        href={`/dashboard/fees/${c.id}`}
                        className="text-xs font-semibold text-brand-blue hover:underline"
                      >
                        💰 שכר טרחה ותשלומים
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
