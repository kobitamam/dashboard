import Link from "next/link";
import { DataUnavailable } from "@/components/form";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { currentRole, loadDashboardData } from "@/lib/db/queries";
import { feeTotals } from "@/lib/fees";
import { formatMoney } from "@/lib/format";

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
  const { cases } = result.data;

  // Each case is billed in two stages: the first when it is opened, the second
  // when it is completed (or, for a betterment levy, when its stage reaches
  // "הושלם"). Cases with something to collect (or no fee set yet) are listed,
  // the ones to collect now first. Payments are recorded on the case's fee page.
  const rows = cases.map((c) => ({
    case: c,
    completed: c.status === "הושלם",
    ...feeTotals(c.fee, c.status === "הושלם"),
  }));
  const billing = rows
    .filter((r) => r.balanceDue > 0 || !r.case.fee || r.completed)
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
        subtitle="שכר הטרחה של התיקים, שלב א׳ בפתיחת תיק ושלב ב׳ בהשלמתו"
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
    </div>
  );
}
