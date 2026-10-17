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

  // Each case is billed in two stages: the first when it is opened, the second
  // when it is completed. Cases with something to collect (or no fee set yet)
  // are listed, the ones to collect now first.
  const billing = cases
    .map((c) => ({ case: c, completed: c.status === "הושלם", ...feeTotals(c.fee, c.status === "הושלם") }))
    .filter((r) => r.balanceDue > 0 || !r.case.fee || r.completed)
    .sort(
      (a, b) =>
        Number(b.balanceDue > 0) - Number(a.balanceDue > 0) || b.balanceDue - a.balanceDue,
    );
  const awaitingCollection = billing.reduce((sum, r) => sum + r.balanceDue, 0);

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
          <div>
            <h2 className="text-lg font-bold">
              תיקים לגבייה
              <span className="mr-2 text-sm font-normal text-muted">({billing.length})</span>
            </h2>
            <p className="text-xs text-muted">
              שלב א׳ - כשנפתח תיק · שלב ב׳ - כשהתיק הושלם
            </p>
          </div>
          {billing.length > 0 && (
            <span className="text-sm text-muted">
              לגבייה כעת:{" "}
              <span className="font-bold text-foreground">{formatMoney(awaitingCollection)}</span>
            </span>
          )}
        </div>
        {billing.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            אין כרגע תיקים לגבייה. תיק חדש יופיע כאן אוטומטית.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-xs text-muted">
                  <th className="px-4 py-3 font-medium">תיק</th>
                  <th className="px-4 py-3 font-medium">לקוח</th>
                  <th className="px-4 py-3 font-medium">שלב א׳</th>
                  <th className="px-4 py-3 font-medium">שלב ב׳</th>
                  <th className="px-4 py-3 font-medium">שולם</th>
                  <th className="px-4 py-3 font-medium">לגבייה כעת</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {billing.map((r) => (
                  <tr key={r.case.id} className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.case.caseNumber}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{r.case.clientName}</td>
                    <td className="px-4 py-3 text-foreground">
                      {r.case.fee ? formatMoney(r.first) : <span className="text-warning">לא הוגדר</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {!r.case.fee
                        ? "—"
                        : r.completed
                          ? formatMoney(r.second)
                          : `${formatMoney(r.second)} · בהשלמת התיק`}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoney(r.paid)}</td>
                    <td className="px-4 py-3">
                      {!r.case.fee ? (
                        <span className="text-muted">—</span>
                      ) : r.balanceDue > 0 ? (
                        <span className="font-semibold text-danger">
                          {formatMoney(r.balanceDue)}
                          <span className="mr-1 text-xs font-normal text-muted">
                            ({r.stageDue === "first" ? "שלב א׳" : "שלב ב׳"})
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold text-success">שולם</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link
                        href={`/dashboard/fees/${r.case.id}`}
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
