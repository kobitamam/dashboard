import Link from "next/link";
import {
  approveQuote,
  createQuote,
  createQuoteDocument,
  deleteQuote,
  getQuoteWordUri,
  rejectQuote,
  startOneDriveUpload,
} from "@/app/dashboard/actions";
import {
  AddRecord,
  ConfirmButton,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectWithNewField,
} from "@/components/form";
import QuoteFileSlot from "@/components/QuoteFileSlot";
import QuoteWordButton from "@/components/QuoteWordButton";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import { currentRole, loadCaseTypes, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { formatDate, formatMoney, formatParcel } from "@/lib/format";
import { isOneDriveConfigured } from "@/lib/onedrive";
import type { QuoteStatus } from "@/lib/types";

const columns: QuoteStatus[] = ["ממתין לאישור", "אושרה", "נדחתה"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if ((await currentRole()) !== "partner") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        <p className="mt-2 text-sm text-muted">הצעות מחיר חשופות לשותפים בלבד.</p>
      </div>
    );
  }

  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { type: typeFilter } = await searchParams;
  const ownerId = await requireOwnerId();
  const types = await loadCaseTypes(ownerId);
  const oneDriveConnected = isOneDriveConfigured() && (await isConnected(ownerId));
  const allQuotes = result.data.quotes;
  const quotes = typeFilter ? allQuotes.filter((q) => q.type === typeFilter) : allQuotes;

  const form = (
    <AddRecord label="+ הצעת מחיר חדשה" action={createQuote}>
      <Field label="גוש" name="block" />
      <Field label="חלקה" name="parcel" />
      <Field label="תת חלקה" name="subParcel" />
      <Field label="רחוב" name="address" placeholder="רחוב ומספר" />
      <Field label="עיר" name="city" />
      <Field label="תיאור" name="description" placeholder="שווי שוק, הפקעה, פינוי בינוי..." />
      <SelectWithNewField label="סוג שומה" name="type" newName="newType" options={types} defaultValue={types[0]} />
      <Field label="לקוח" name="clientName" required placeholder="שם הלקוח" />
      <Field label="מייל" name="clientEmail" type="email" />
      <Field label="טלפון" name="clientPhone" />
      <Field label="סכום ההצעה (₪)" name="amount" type="number" min={0} required />
      <Field label="שכ״ט" name="feeNote" placeholder="לדוגמה: 10,000 ₪ + מע״מ" />
      <Field label="אחוז שכ״ט מהפחתה (%)" name="feePercent" type="number" min={0} max={100} step="any" />
      <Field label="הערות" name="notes" />
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="הצעות מחיר"
        subtitle={
          allQuotes.length
            ? `${allQuotes.length} הצעות במערכת`
            : "עדיין לא נוצרו הצעות מחיר"
        }
        action={allQuotes.length > 0 ? form : undefined}
      />

      {allQuotes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href="/dashboard/quotes"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${!typeFilter ? "bg-brand-blue text-white" : "bg-surface text-muted hover:bg-background"}`}
          >
            הכל
          </Link>
          {types.map((t) => (
            <Link
              key={t}
              href={`/dashboard/quotes?type=${encodeURIComponent(t)}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${typeFilter === t ? "bg-brand-blue text-white" : "bg-surface text-muted hover:bg-background"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          title="אין הצעות מחיר"
          hint="צור הצעת מחיר חדשה. לאחר אישור הלקוח והעלאת ההצעה החתומה, המערכת תפתח עבורה תיק (עבודה) אוטומטית."
          action={form}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((status) => {
            const items = quotes.filter((q) => q.status === status);
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <StatusBadge status={status} />
                  <span className="text-xs text-muted">{items.length} הצעות</span>
                </div>

                {items.map((q) => (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted">{q.quoteNumber}</span>
                      <span className="text-xs text-muted">{formatDate(q.date)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{q.clientName}</p>
                    {(q.clientEmail || q.clientPhone) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[q.clientEmail, q.clientPhone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {(q.address || q.city) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[q.address, q.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {formatParcel(q.block, q.parcel, q.subParcel) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {formatParcel(q.block, q.parcel, q.subParcel)}
                      </p>
                    )}
                    {q.description && <p className="mt-1 text-xs font-medium text-brand-blue">{q.description}</p>}
                    {q.type && <p className="mt-0.5 text-xs text-muted">{q.type}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{formatMoney(q.amount)}</span>
                      {q.feeNote && <span className="text-xs text-muted">שכ״ט: {q.feeNote}</span>}
                    </div>
                    {q.feePercent !== null && (
                      <p className="mt-0.5 text-xs text-muted">
                        אחוז שכ״ט מהפחתה: {q.feePercent}%
                      </p>
                    )}
                    {q.notes && <p className="mt-1 text-xs text-muted">{q.notes}</p>}

                    <div className="mt-3 space-y-1.5">
                      <QuoteWordButton
                        quoteId={q.id}
                        url={q.wordFileUrl}
                        oneDriveConnected={oneDriveConnected}
                        createDocument={createQuoteDocument}
                        getWordUri={getQuoteWordUri}
                      />
                      {q.status !== "נדחתה" && (
                        <QuoteFileSlot
                          quoteId={q.id}
                          label="הצעה חתומה"
                          file={q.signedFile}
                          oneDriveConnected={oneDriveConnected}
                          startUpload={startOneDriveUpload}
                        />
                      )}
                    </div>

                    {q.linkedCaseId && (
                      <Link
                        href="/dashboard/cases"
                        className="mt-2 inline-block text-xs font-medium text-brand-blue hover:underline"
                      >
                        ✓ נפתח תיק עבור הצעה זו
                      </Link>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {status === "ממתין לאישור" && (
                          <>
                            <ConfirmButton
                              action={approveQuote.bind(null, q.id)}
                              confirmText="לאשר את ההצעה ולפתוח תיק? (יש להעלות קודם את ההצעה החתומה)"
                              tone="success"
                            >
                              אישור ופתיחת תיק
                            </ConfirmButton>
                            <ConfirmButton
                              action={rejectQuote.bind(null, q.id)}
                              confirmText="לסמן את ההצעה כנדחתה?"
                              tone="danger"
                            >
                              דחייה
                            </ConfirmButton>
                          </>
                        )}
                      </div>
                      <DeleteButton
                        action={deleteQuote.bind(null, q.id)}
                        confirmText={`למחוק את הצעה ${q.quoteNumber}?`}
                      />
                    </div>
                  </Card>
                ))}

                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    אין הצעות בסטטוס זה
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
