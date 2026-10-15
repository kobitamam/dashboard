import Link from "next/link";
import {
  approveQuote,
  confirmQuoteUpload,
  createQuote,
  deleteQuote,
  rejectQuote,
  requestQuoteDownloadUrl,
  requestQuoteUploadUrl,
} from "@/app/dashboard/actions";
import {
  AddRecord,
  ConfirmButton,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import QuoteFileSlot from "@/components/QuoteFileSlot";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { loadDashboardData } from "@/lib/db/queries";
import { formatMoney } from "@/lib/format";
import { caseTypes, type QuoteStatus } from "@/lib/types";

const columns: QuoteStatus[] = ["ממתין לאישור", "אושרה", "נדחתה"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { type: typeFilter } = await searchParams;
  const allQuotes = result.data.quotes;
  const quotes = typeFilter ? allQuotes.filter((q) => q.type === typeFilter) : allQuotes;

  const form = (
    <AddRecord label="+ הצעת מחיר חדשה" action={createQuote}>
      <Field label="לקוח" name="clientName" required placeholder="שם הלקוח" />
      <Field label="כתובת הנכס" name="address" placeholder="רחוב, עיר" />
      <SelectField label="סוג שומה" name="type" options={caseTypes} defaultValue={caseTypes[0]} />
      <Field label="סכום ההצעה (₪)" name="amount" type="number" min={0} required />
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
          {caseTypes.map((t) => (
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
                      <span className="text-xs font-semibold text-foreground">
                        {formatMoney(q.amount)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{q.clientName}</p>
                    {q.address && <p className="mt-0.5 text-xs text-muted">{q.address}</p>}
                    {q.type && <p className="mt-2 text-xs font-medium text-brand-blue">{q.type}</p>}

                    <div className="mt-3 space-y-1.5">
                      <QuoteFileSlot
                        quoteId={q.id}
                        slot="draftFile"
                        label="הצעה (טיוטה)"
                        file={q.draftFile}
                        requestUploadUrl={requestQuoteUploadUrl}
                        confirmUpload={confirmQuoteUpload}
                        requestDownloadUrl={requestQuoteDownloadUrl}
                      />
                      {q.status !== "נדחתה" && (
                        <QuoteFileSlot
                          quoteId={q.id}
                          slot="signedFile"
                          label="הצעה חתומה"
                          file={q.signedFile}
                          requestUploadUrl={requestQuoteUploadUrl}
                          confirmUpload={confirmQuoteUpload}
                          requestDownloadUrl={requestQuoteDownloadUrl}
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
