import {
  createCase,
  createQuoteDocument,
  deleteCase,
  getQuoteWordUri,
  retryCaseOneDriveFolder,
  updateCaseProgress,
} from "@/app/dashboard/actions";
import CaseFolderRetry from "@/components/CaseFolderRetry";
import QuoteWordButton from "@/components/QuoteWordButton";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import Link from "next/link";
import { Card, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { currentRole, loadCaseTypes, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { caseDeadlines } from "@/lib/deadlines";
import { daysUntil, formatDate, formatParcel, formatTime } from "@/lib/format";
import {
  BETTERMENT_LEVY,
  bettermentStageNames,
  caseStatuses,
  type CaseStatus,
} from "@/lib/types";

const columns: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "הושלם"];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { type: typeFilter } = await searchParams;
  const isPartner = (await currentRole()) === "partner";
  const types = await loadCaseTypes(await requireOwnerId());
  const allCases = result.data.cases;
  // Quotes are partners-only, so for an employee this stays empty and no quote link is shown.
  const quotesById = new Map(result.data.quotes.map((q) => [q.id, q]));
  const cases = typeFilter ? allCases.filter((c) => c.type === typeFilter) : allCases;
  const urgent = cases.filter((c) => c.status === "דחוף").length;

  const form = (
    <AddRecord label="+ תיק חדש" action={createCase}>
      <Field label="גוש" name="block" />
      <Field label="חלקה" name="parcel" />
      <Field label="תת חלקה" name="subParcel" />
      <Field label="רחוב" name="address" placeholder="רחוב ומספר" />
      <Field label="עיר" name="city" />
      <Field label="תיאור" name="description" placeholder="שווי שוק, הפקעה, פינוי בינוי..." />
      <SelectField label="סוג שומה" name="type" options={types} defaultValue={types[0]} />
      <Field label="לקוח" name="clientName" required placeholder="שם הלקוח" />
      <Field label="מייל" name="clientEmail" type="email" />
      <Field label="טלפון" name="clientPhone" />
      <SelectField label="סטטוס" name="status" options={caseStatuses} defaultValue="בתהליך" />
      <Field label="תאריך יעד" name="dueDate" type="date" />
      <Field label="היטל השבחה - מועד א׳: יום אחרון לבקשת מינוי שמאי מכריע" name="arbitratorRequestDate" type="date" />
      <Field label="היטל השבחה - מועד ב׳: יום אחרון להגשת שומה נגדית" name="counterAppraisalDate" type="date" />
      <Field label="התקדמות (%)" name="progress" type="number" min={0} max={100} defaultValue={0} />
      <SelectField
        label="היטל השבחה - שלב (במקום אחוז ההתקדמות)"
        name="bettermentStage"
        options={bettermentStageNames}
        defaultValue={bettermentStageNames[0]}
      />
      {isPartner && (
        <Field label="שכ״ט" name="feeNote" placeholder="לדוגמה: 10,000 ₪ + מע״מ" />
      )}
      <Field label="הערות" name="notes" />
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="מעקב תיקים"
        subtitle={
          allCases.length
            ? `${allCases.length} תיקים במערכת · ${urgent} דחופים`
            : "עדיין לא נפתחו תיקים"
        }
        action={allCases.length > 0 ? form : undefined}
      />

      {allCases.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href="/dashboard/cases"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${!typeFilter ? "bg-brand-blue text-white" : "bg-surface text-muted hover:bg-background"}`}
          >
            הכל
          </Link>
          {types.map((t) => (
            <Link
              key={t}
              href={`/dashboard/cases?type=${encodeURIComponent(t)}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${typeFilter === t ? "bg-brand-blue text-white" : "bg-surface text-muted hover:bg-background"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {cases.length === 0 ? (
        <EmptyState
          title="אין עדיין תיקים"
          hint="פתח תיק ראשון. תיק עם תאריך יעד מתקרב יפיק אוטומטית התראה במסך ההתראות."
          action={form}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((status) => {
            const items = cases.filter((c) => c.status === status);
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <StatusBadge status={status} />
                  <span className="text-xs text-muted">{items.length} תיקים</span>
                </div>

                {items.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted">{c.caseNumber}</span>
                      <span className="text-xs text-muted">{formatDate(c.dueDate)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{c.clientName}</p>
                    {(c.clientEmail || c.clientPhone) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[c.clientEmail, c.clientPhone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {(c.address || c.city) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[c.address, c.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {formatParcel(c.block, c.parcel, c.subParcel) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {formatParcel(c.block, c.parcel, c.subParcel)}
                      </p>
                    )}
                    {c.description && <p className="mt-1 text-xs font-medium text-brand-blue">{c.description}</p>}
                    {c.type && <p className="mt-0.5 text-xs text-muted">{c.type}</p>}
                    {isPartner && c.feeNote && (
                      <p className="mt-1 text-xs text-muted">שכ״ט: {c.feeNote}</p>
                    )}
                    {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
                    {result.data.events
                      .filter((e) => e.caseId === c.id && (daysUntil(e.start) ?? 0) >= 0)
                      .slice(0, 2)
                      .map((e) => (
                        <p key={e.id} className="mt-1 text-xs font-medium text-brand-blue">
                          {e.type}: {formatDate(e.start)} {formatTime(e.start)}
                        </p>
                      ))}
                    {caseDeadlines(c)
                      .filter((d) => d.key !== "due")
                      .map((d) => (
                        <p key={d.key} className="mt-1 text-xs font-medium text-warning">
                          {d.label}: {formatDate(d.date)}
                        </p>
                      ))}

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {c.oneDriveFolderUrl ? (
                        <a
                          href={c.oneDriveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-blue hover:underline"
                        >
                          📁 תיקיית התיק ב-OneDrive
                        </a>
                      ) : (
                        <CaseFolderRetry caseId={c.id} retry={retryCaseOneDriveFolder} />
                      )}
                      {isPartner && (
                        <Link href={`/dashboard/fees/${c.id}`} className="font-medium text-brand-blue hover:underline">
                          💰 שכר טרחה
                        </Link>
                      )}
                    </div>

                    {isPartner && c.fromQuoteId && quotesById.get(c.fromQuoteId)?.wordFileUrl && (
                      <div className="mt-2">
                        <QuoteWordButton
                          quoteId={c.fromQuoteId}
                          url={quotesById.get(c.fromQuoteId)!.wordFileUrl}
                          oneDriveConnected
                          createDocument={createQuoteDocument}
                          getWordUri={getQuoteWordUri}
                        />
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span>
                          {c.type === BETTERMENT_LEVY
                            ? `שלב: ${c.bettermentStage ?? bettermentStageNames[0]}`
                            : "התקדמות"}
                        </span>
                        <span>{c.progress}%</span>
                      </div>
                      <ProgressBar value={c.progress} />
                    </div>

                    <form action={updateCaseProgress.bind(null, c.id)} className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          name="status"
                          defaultValue={c.status}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-brand-cyan"
                        >
                          {caseStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {c.type === BETTERMENT_LEVY ? (
                          <select
                            name="bettermentStage"
                            defaultValue={c.bettermentStage ?? bettermentStageNames[0]}
                            aria-label="שלב"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-brand-cyan"
                          >
                            {bettermentStageNames.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            name="progress"
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={c.progress}
                            aria-label="אחוז התקדמות"
                            className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-brand-cyan"
                          />
                        )}
                      </div>
                      <DateInput label="תאריך יעד" name="dueDate" value={c.dueDate} />
                      {c.type === BETTERMENT_LEVY && (
                        <>
                          <DateInput
                            label="מועד א׳ - בקשת מינוי שמאי מכריע"
                            name="arbitratorRequestDate"
                            value={c.arbitratorRequestDate}
                          />
                          <DateInput
                            label="מועד ב׳ - הגשת שומה נגדית"
                            name="counterAppraisalDate"
                            value={c.counterAppraisalDate}
                          />
                        </>
                      )}
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-brand-cyan-light px-2 py-1.5 text-[11px] font-bold text-brand-blue hover:opacity-80"
                      >
                        עדכון
                      </button>
                    </form>

                    <div className="mt-2 flex justify-end">
                      <DeleteButton
                        action={deleteCase.bind(null, c.id)}
                        confirmText={`למחוק את תיק ${c.caseNumber}?`}
                      />
                    </div>
                  </Card>
                ))}

                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    אין תיקים בסטטוס זה
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

function DateInput({ label, name, value }: { label: string; name: string; value: string | null }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
      <span>{label}</span>
      <input
        name={name}
        type="date"
        defaultValue={value ?? ""}
        className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-brand-cyan"
      />
    </label>
  );
}
