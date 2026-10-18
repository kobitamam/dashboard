import {
  createCase,
  deleteCaseType,
  deleteCase,
  removeCaseShareLink,
  renameCaseType,
  retryCaseOneDriveFolder,
  updateCaseProgress,
} from "@/app/dashboard/actions";
import CaseFolderRetry from "@/components/CaseFolderRetry";
import TypeManager from "@/components/TypeManager";
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
import { currentRole, currentUserId, loadCaseTypes, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { caseDeadlines } from "@/lib/deadlines";
import { caseHaystack, matchesQuery } from "@/lib/search";
import { listOrganizationMembers, type OrganizationMember } from "@/lib/users";
import { daysUntil, formatDate, formatParcel, formatTime } from "@/lib/format";
import {
  BETTERMENT_LEVY,
  bettermentStageNames,
  caseStatuses,
  caseTypes as builtInCaseTypes,
  type CaseStatus,
} from "@/lib/types";

const columns: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "נשלחה טיוטה", "הושלם"];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; scope?: string; search?: string }>;
}) {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable reason={result.reason} />;
  const { type: typeFilter, scope, search } = await searchParams;
  const isPartner = (await currentRole()) === "partner";
  const ownerId = await requireOwnerId();
  const types = await loadCaseTypes(ownerId);
  const members = await listOrganizationMembers(ownerId);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const allCases = result.data.cases;
  // "My cases" is only a filter - everyone can switch back to see all the cases.
  const userId = await currentUserId();
  const isMine = (c: (typeof allCases)[number]) => c.partnerId === userId || c.employeeId === userId;
  const mineOnly = scope === "mine";
  const mineCount = allCases.filter(isMine).length;
  const cases = allCases
    .filter((c) => !typeFilter || c.type === typeFilter)
    .filter((c) => !mineOnly || isMine(c))
    .filter((c) => !search || matchesQuery(caseHaystack(c), search));
  const href = (next: { type?: string; mine?: boolean; keepSearch?: boolean }) => {
    const params = new URLSearchParams();
    if (next.type) params.set("type", next.type);
    if (next.mine) params.set("scope", "mine");
    if (search && next.keepSearch !== false) params.set("search", search);
    const query = params.toString();
    return `/dashboard/cases${query ? `?${query}` : ""}`;
  };
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-brand-blue text-white" : "bg-surface text-muted hover:bg-background"}`;
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
      <MemberSelect label="שותף מטפל" name="partnerId" role="partner" members={members} value={null} />
      <MemberSelect label="עובד מטפל" name="employeeId" role="employee" members={members} value={null} />
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

      {search && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-cyan-light px-4 py-2.5 text-sm text-brand-blue">
          <span>
            תוצאות חיפוש: <strong>{search}</strong> ({cases.length})
          </span>
          <Link href={href({ type: typeFilter, mine: mineOnly, keepSearch: false })} className="font-semibold underline">
            נקה
          </Link>
        </div>
      )}

      {allCases.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ type: typeFilter })} className={chip(!mineOnly)}>
              כל התיקים
            </Link>
            <Link href={href({ type: typeFilter, mine: true })} className={chip(mineOnly)}>
              התיקים שלי ({mineCount})
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ mine: mineOnly })} className={chip(!typeFilter)}>
              הכל
            </Link>
            {types.map((t) => (
              <Link key={t} href={href({ type: t, mine: mineOnly })} className={chip(typeFilter === t)}>
                {t}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isPartner && (
        <div className="mb-4">
          <TypeManager
            title="ניהול סוגי שומה"
            types={types.filter((t) => !(builtInCaseTypes as string[]).includes(t))}
            deleteNote="תיקים והצעות מהסוג הזה יעברו ל״אחר״."
            rename={renameCaseType}
            remove={deleteCaseType}
          />
        </div>
      )}

      {cases.length === 0 ? (
        allCases.length > 0 ? (
          <EmptyState
            title={mineOnly ? "אין תיקים שמשויכים אליך" : "אין תיקים מהסוג הזה"}
            hint={mineOnly ? "לחץ על \"כל התיקים\" כדי לראות את כולם." : "בחר סוג אחר או \"הכל\"."}
          />
        ) : (
          <EmptyState
            title="אין עדיין תיקים"
            hint="פתח תיק ראשון. תיק עם תאריך יעד מתקרב יפיק אוטומטית התראה במסך ההתראות."
            action={form}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                    {(c.partnerId || c.employeeId) && (
                      <p className="mt-1 text-xs text-foreground/80">
                        {[
                          c.partnerId && `שותף: ${nameOf.get(c.partnerId) ?? "—"}`,
                          c.employeeId && `עובד: ${nameOf.get(c.employeeId) ?? "—"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {isPartner && c.feeNote && (
                      <p className="mt-1 text-xs text-muted">שכ״ט: {c.feeNote}</p>
                    )}
                    {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
                    {result.data.events
                      .filter((e) => e.caseId === c.id && (daysUntil(e.start) ?? 0) >= 0)
                      .slice(0, 2)
                      .map((e) => (
                        <p key={e.id} className="mt-1 text-xs font-medium text-brand-blue">
                          {e.type}: {formatDate(e.start)} {e.allDay ? "(כל היום)" : formatTime(e.start)}
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
                      {isPartner ? (
                        c.oneDriveFolderUrl ? (
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
                        )
                      ) : (
                        // Employees open the folder from their own synced copy of "מסמכי תיקים"; the
                        // owner's web link would only ask for the owner's sign-in.
                        c.oneDriveFolderName && (
                          <span className="text-muted">📁 מסמכי תיקים / {c.oneDriveFolderName}</span>
                        )
                      )}
                      {isPartner && c.oneDriveFolderName && (
                        // Runs the "OpenCase" shortcut on the Mac, which reveals the case folder in Finder.
                        <a
                          href={`shortcuts://run-shortcut?name=OpenCase&input=text&text=${encodeURIComponent(c.oneDriveFolderName)}`}
                          className="font-medium text-brand-blue hover:underline"
                          title="פותח את תיקיית התיק ב-Finder (דורש את קיצור הדרך OpenCase ב-Mac)"
                        >
                          🖥️ פתח ב-Finder
                        </a>
                      )}
                      {isPartner && c.oneDriveShareUrl && (
                        <CaseFolderRetry
                          caseId={c.id}
                          retry={removeCaseShareLink}
                          prompt="🔗 קיים קישור שיתוף ציבורי"
                          action="בטל קישור"
                        />
                      )}
                      {isPartner && (
                        <Link href={`/dashboard/fees/${c.id}`} className="font-medium text-brand-blue hover:underline">
                          💰 שכר טרחה
                        </Link>
                      )}
                    </div>

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
                      <MemberSelect
                        label="שותף מטפל"
                        name="partnerId"
                        role="partner"
                        members={members}
                        value={c.partnerId}
                        compact
                      />
                      <MemberSelect
                        label="עובד מטפל"
                        name="employeeId"
                        role="employee"
                        members={members}
                        value={c.employeeId}
                        compact
                      />
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

// Picks who handles a case: a partner in one picker, an employee in the other.
function MemberSelect({
  label,
  name,
  role,
  members,
  value,
  compact,
}: {
  label: string;
  name: string;
  role: OrganizationMember["role"];
  members: OrganizationMember[];
  value: string | null;
  compact?: boolean;
}) {
  const options = members.filter((m) => m.role === role);
  const select = (
    <select
      name={name}
      defaultValue={value ?? ""}
      className={
        compact
          ? "min-w-0 rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-brand-cyan"
          : "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
      }
    >
      <option value="">ללא</option>
      {options.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );

  return compact ? (
    <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
      <span>{label}</span>
      {select}
    </label>
  ) : (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {select}
    </label>
  );
}
