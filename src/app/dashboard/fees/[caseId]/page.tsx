import Link from "next/link";
import { addFeePayment, removeFeePayment, setCaseFee } from "@/app/dashboard/actions";
import { DeleteButton, Field, SubmitButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { casesRepo, toCase } from "@/lib/db/entities";
import { currentRole, requireOwnerId } from "@/lib/db/queries";
import { formatDate, formatMoney } from "@/lib/format";

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
  const totalFee = fee ? fee.baseAmount + (fee.successPercentage / 100) * fee.successAmount : 0;
  const totalPaid = fee ? fee.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const balance = totalFee - totalPaid;

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
          <form action={setCaseFee.bind(null, c.id)} className="space-y-4">
            <Field
              label="שכר טרחה בסיסי / מקדמה (₪)"
              name="baseAmount"
              type="number"
              min={0}
              defaultValue={fee?.baseAmount ?? 0}
            />
            <Field
              label="אחוז מהצלחה (%)"
              name="successPercentage"
              type="number"
              min={0}
              max={100}
              defaultValue={fee?.successPercentage ?? 0}
            />
            <Field
              label="הסכום שנחסך ללקוח - בסיס לחישוב האחוז (₪)"
              name="successAmount"
              type="number"
              min={0}
              defaultValue={fee?.successAmount ?? 0}
            />
            <SubmitButton>שמירה</SubmitButton>
          </form>

          {fee && (
            <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">שכר טרחה כולל (מחושב)</span>
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
