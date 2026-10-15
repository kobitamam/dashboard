import {
  confirmCaseUpload,
  createCase,
  deleteCase,
  deleteCaseAttachment,
  requestCaseDownloadUrl,
  requestCaseUploadUrl,
  updateCaseProgress,
} from "@/app/dashboard/actions";
import CaseAttachments from "@/components/CaseAttachments";
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
import { currentRole, loadDashboardData } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { caseStatuses, caseTypes, type CaseStatus } from "@/lib/types";

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
  const allCases = result.data.cases;
  const cases = typeFilter ? allCases.filter((c) => c.type === typeFilter) : allCases;
  const urgent = cases.filter((c) => c.status === "דחוף").length;

  const form = (
    <AddRecord label="+ תיק חדש" action={createCase}>
      <Field label="לקוח" name="clientName" required placeholder="שם הלקוח" />
      <Field label="כתובת הנכס" name="address" placeholder="רחוב, עיר" />
      <SelectField label="סוג שומה" name="type" options={caseTypes} defaultValue={caseTypes[0]} />
      <SelectField label="סטטוס" name="status" options={caseStatuses} defaultValue="בתהליך" />
      <Field label="תאריך יעד" name="dueDate" type="date" />
      <Field label="התקדמות (%)" name="progress" type="number" min={0} max={100} defaultValue={0} />
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
          {caseTypes.map((t) => (
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
                    {c.address && <p className="mt-0.5 text-xs text-muted">{c.address}</p>}
                    {c.type && <p className="mt-2 text-xs font-medium text-brand-blue">{c.type}</p>}

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
                        <span className="text-muted">
                          📁 אין תיקיית OneDrive (חבר את OneDrive ביומן)
                        </span>
                      )}
                      {isPartner && (
                        <Link href={`/dashboard/fees/${c.id}`} className="font-medium text-brand-blue hover:underline">
                          💰 שכר טרחה
                        </Link>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span>התקדמות</span>
                        <span>{c.progress}%</span>
                      </div>
                      <ProgressBar value={c.progress} />
                    </div>

                    <form
                      action={updateCaseProgress.bind(null, c.id)}
                      className="mt-3 flex items-center gap-1.5"
                    >
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
                      <input
                        name="progress"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={c.progress}
                        className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-brand-cyan"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-cyan-light px-2 py-1.5 text-[11px] font-bold text-brand-blue hover:opacity-80"
                      >
                        עדכון
                      </button>
                    </form>

                    <CaseAttachments
                      caseId={c.id}
                      attachments={c.attachments}
                      requestUploadUrl={requestCaseUploadUrl}
                      confirmUpload={confirmCaseUpload}
                      requestDownloadUrl={requestCaseDownloadUrl}
                      deleteAttachment={deleteCaseAttachment}
                    />

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
