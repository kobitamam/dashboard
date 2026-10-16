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
import { currentRole, loadCaseTypes, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { formatDate, formatParcel } from "@/lib/format";
import { isR2Configured } from "@/lib/r2";
import { caseStatuses, type CaseStatus } from "@/lib/types";

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
  const uploadsEnabled = isR2Configured();
  const allCases = result.data.cases;
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
      <Field label="התקדמות (%)" name="progress" type="number" min={0} max={100} defaultValue={0} />
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
                      uploadsEnabled={uploadsEnabled}
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
