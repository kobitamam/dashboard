import Link from "next/link";
import {
  createBettermentStatement,
  createTransactionStatement,
  getTransactionStatementWordUri,
} from "@/app/dashboard/actions";
import { DataUnavailable } from "@/components/form";
import TransactionStatements from "@/components/TransactionStatements";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import { currentRole, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { isOneDriveConfigured } from "@/lib/onedrive";
import { feeStageOf, feeTotals } from "@/lib/fees";
import { emptyUnit } from "@/lib/betterment-statement";
import { formatMoney } from "@/lib/format";
import { BETTERMENT_LEVY, type Case } from "@/lib/types";
import { removeVat } from "@/lib/vat";

// The closing statement's form starts from the last one typed for the case, or else from the case
// itself: its fee's share of the reduction, and its first payment (before VAT) as the offset.
function bettermentDefaults(c: Case) {
  if (c.bettermentStatementInput) return c.bettermentStatementInput;
  const first = c.fee?.installments?.[0]?.amount ?? c.fee?.baseAmount ?? 0;
  return {
    attention: "",
    units: [emptyUnit(c.address)],
    feePercent: c.fee?.successPercentage ?? 0,
    offset: first > 0 ? Math.round(removeVat(first)) : 0,
  };
}

export default async function BillingPage() {
  if ((await currentRole()) !== "partner") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        <p className="mt-2 text-sm text-muted">נתוני הגבייה חשופים לשותפים בלבד.</p>
      </div>
    );
  }

  const ownerId = await requireOwnerId();
  const [result, oneDriveConnected] = await Promise.all([
    loadDashboardData(),
    isOneDriveConfigured() ? isConnected(ownerId) : false,
  ]);
  if (!result.ok) return <DataUnavailable reason={result.reason} />;
  const { cases } = result.data;

  // Each case's fee is collected in the installments set in its quote: the first when the case
  // is opened, the last when it is completed (or, for a betterment levy, when its stage reaches
  // "הושלם"), any in between once the draft is sent. Cases with something to collect (or no fee
  // set yet) are listed, the ones to collect now first. Payments are recorded on the fee page.
  const rows = cases.map((c) => ({
    case: c,
    completed: c.status === "הושלם",
    ...feeTotals(c.fee, feeStageOf(c)),
  }));
  const billing = rows
    // A betterment-levy case stays listed, for its closing statement (גמר חשבון).
    .filter((r) => r.balanceDue > 0 || !r.case.fee || r.completed || r.case.type === BETTERMENT_LEVY)
    .sort(
      (a, b) =>
        Number(b.balanceDue > 0) - Number(a.balanceDue > 0) || b.balanceDue - a.balanceDue,
    );
  const awaitingCollection = rows.reduce((sum, r) => sum + r.balanceDue, 0);
  const received = rows.reduce((sum, r) => sum + r.paid, 0);
  const upcoming = rows.reduce((sum, r) => sum + Math.max(0, r.total - Math.max(r.dueNow, r.paid)), 0);

  return (
    <div>
      <PageHeader
        title="גבייה"
        subtitle="תשלומי שכר הטרחה של התיקים, לפי התשלומים שנקבעו בהצעת המחיר"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="לגבייה כעת" value={formatMoney(awaitingCollection)} tone="danger" />
        <StatCard label="התקבל" value={formatMoney(received)} tone="success" />
        <StatCard label="צפוי בהמשך" value={formatMoney(upcoming)} tone="warning" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-lg font-bold">
              תיקים לגבייה
              <span className="mr-2 text-sm font-normal text-muted">({billing.length})</span>
            </h2>
            <p className="text-xs text-muted">
              תשלום ראשון - כשנפתח תיק · אחרון - כשהתיק הושלם · באמצע - כשנשלחה טיוטה
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
                  <th className="px-4 py-3 font-medium">תשלומים (כולל מע״מ)</th>
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
                    <td className="px-4 py-3">
                      {!r.case.fee ? (
                        <span className="text-warning">לא הוגדר</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.rows.map((row) => (
                            <span
                              key={row.label}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                row.covered
                                  ? "bg-success/10 text-success"
                                  : row.due
                                    ? "bg-danger/10 text-danger"
                                    : "bg-background text-muted"
                              }`}
                              title={row.covered ? "שולם" : row.due ? "לגבייה כעת" : "עדיין לא הגיע מועד הגבייה"}
                            >
                              {row.label}: {formatMoney(row.amount)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoney(r.paid)}</td>
                    <td className="px-4 py-3">
                      {!r.case.fee ? (
                        <span className="text-muted">—</span>
                      ) : r.balanceDue > 0 ? (
                        <span className="font-semibold text-danger">
                          {formatMoney(r.balanceDue)}
                        </span>
                      ) : (
                        <span className="font-semibold text-success">שולם</span>
                      )}
                    </td>
                    <td className="space-y-1.5 px-4 py-3 text-left">
                      <Link
                        href={`/dashboard/fees/${r.case.id}`}
                        className="block text-xs font-semibold text-brand-blue hover:underline"
                      >
                        💰 שכר טרחה ותשלומים
                      </Link>
                      <TransactionStatements
                        caseId={r.case.id}
                        statements={r.case.transactionStatements}
                        canCreate={r.balanceDue > 0}
                        oneDriveConnected={oneDriveConnected}
                        create={createTransactionStatement}
                        getWordUri={getTransactionStatementWordUri}
                        betterment={
                          r.case.type === BETTERMENT_LEVY
                            ? { defaults: bettermentDefaults(r.case), create: createBettermentStatement }
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
