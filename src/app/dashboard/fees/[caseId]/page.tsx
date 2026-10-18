import Link from "next/link";
import { addFeePayment, removeFeePayment, setCaseFee } from "@/app/dashboard/actions";
import { DeleteButton, Field, SubmitButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { casesRepo, toCase } from "@/lib/db/entities";
import { currentRole, requireOwnerId } from "@/lib/db/queries";
import FeeStructureFields from "@/components/FeeStructureFields";
import { feeStageOf, feeTotals } from "@/lib/fees";
import { removeVat } from "@/lib/vat";
import { formatDate, formatMoney } from "@/lib/format";
import { BETTERMENT_LEVY } from "@/lib/types";

export default async function CaseFeePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const ownerId = await requireOwnerId();

  if ((await currentRole()) !== "partner") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        <p className="mt-2 text-sm text-muted">נתוני שכר טרחה חשופים לשותפים בלבד.</p>
      </div>
    );
  }

  const doc = await casesRepo.get(ownerId, caseId);
  if (!doc) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">התיק לא נמצא</p>
      </div>
    );
  }
  const c = toCase(doc);
  const fee = c.fee;
  const isBettermentLevy = c.type === BETTERMENT_LEVY;
  const { rows, total: totalFee, paid: totalPaid, balance } = feeTotals(fee, feeStageOf(c));

  // The form shows the fixed fee as it was saved (or, for a fee saved the old way, from its two stages).
  const fixed = fee
    ? fee.installments?.length
      ? fee.installments
      : [fee.baseAmount, ...(fee.finalAmount > 0 ? [fee.finalAmount] : [])].map((amount, _, all) => ({
          amount,
          percent: Math.round((amount / all.reduce((sum, a) => sum + a, 0)) * 100),
        }))
    : [];
  const fixedInclVat = fixed.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div>
      <PageHeader
        title={`שכר טרחה - תיק ${c.caseNumber}`}
        subtitle={`${c.clientName}${c.address ? ` · ${c.address}` : ""}`}
        action={
          <Link
            href="/dashboard/cases"
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-background"
          >
            חזרה לתיקים
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-4 text-lg font-bold">מבנה שכר הטרחה</h2>
          <p className="mb-4 text-xs text-muted">
            התשלום הראשון נגבה כשנפתח התיק, האחרון כשהתיק הושלם, ומה שבאמצע כשנשלחה טיוטה.
            {isBettermentLevy && " בהיטל השבחה נוסף גם אחוז מההפחתה, שנגבה כשהתיק הושלם."}
          </p>
          <form action={setCaseFee.bind(null, c.id)} className="grid grid-cols-1 gap-4">
            <FeeStructureFields
              betterment={isBettermentLevy}
              defaults={{
                exVat: removeVat(fixedInclVat),
                inclVat: fixedInclVat,
                percents: fixed.map((i) => i.percent),
                feePercent: fee?.successPercentage ?? null,
              }}
            />
            {isBettermentLevy && (
              <Field
                label="סכום ההפחתה שהושגה - בסיס לחישוב האחוז (₪)"
                name="successAmount"
                type="number"
                min={0}
                defaultValue={fee?.successAmount ?? 0}
              />
            )}
            <SubmitButton>שמירה</SubmitButton>
          </form>

          {fee && (
            <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted">
                    {row.label}
                    {!row.due && " (עדיין לא הגיע מועדו)"}
                  </span>
                  <span className={`font-semibold ${row.covered ? "text-success" : ""}`}>
                    {formatMoney(row.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted">שכר טרחה כולל מע״מ (מחושב)</span>
                <span className="font-semibold">{formatMoney(totalFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">התקבל עד כה</span>
                <span className="font-semibold text-success">{formatMoney(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">יתרה לתשלום</span>
                <span className={`font-semibold ${balance > 0 ? "text-danger" : "text-success"}`}>
                  {formatMoney(balance)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">תקבולים</h2>

          {!fee ? (
            <p className="text-sm text-muted">יש להגדיר קודם את מבנה שכר הטרחה.</p>
          ) : (
            <>
              <form
                action={addFeePayment.bind(null, c.id)}
                className="grid grid-cols-1 gap-3 border-b border-border pb-4 sm:grid-cols-3"
              >
                <Field label="סכום שהתקבל (₪)" name="amount" type="number" min={0} required />
                <Field label="תאריך" name="date" type="date" />
                <Field label="הערה" name="note" placeholder="לדוגמה: מקדמה ראשונה" />
                <div className="sm:col-span-3">
                  <SubmitButton>הוספת תקבול</SubmitButton>
                </div>
              </form>

              {fee.payments.length === 0 ? (
                <p className="mt-4 text-sm text-muted">עדיין לא נרשמו תקבולים.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {fee.payments.map((p, i) => (
                    <div
                      key={`${p.date}-${i}`}
                      className="flex items-center justify-between rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{formatMoney(p.amount)}</p>
                        <p className="text-xs text-muted">
                          {formatDate(p.date)}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      <DeleteButton
                        action={removeFeePayment.bind(null, c.id, i)}
                        confirmText="למחוק את התקבול?"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
