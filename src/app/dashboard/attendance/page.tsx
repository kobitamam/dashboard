import {
  addAttendanceEntry,
  clockIn,
  clockOut,
  editAttendanceEntry,
  removeAttendanceEntry,
} from "@/app/dashboard/attendance-actions";
import Link from "next/link";
import AttendanceFilters from "@/components/AttendanceFilters";
import { DeleteButton, EditRecord, EmptyState, Field } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { attendanceRepo, toAttendance } from "@/lib/db/entities";
import {
  currentMonth,
  entryHours,
  entryMonth,
  isMonth,
  monthLabel,
  peopleOf,
  totalsByPerson,
} from "@/lib/attendance-report";
import { currentRole, currentUserId, requireOwnerId } from "@/lib/db/queries";
import { formatDuration, formatIsraelDate, formatIsraelTime, toIsraelParts } from "@/lib/format";
import type { AttendanceEntry } from "@/lib/types";
import { listOrganizationMembers } from "@/lib/users";

// The day and the entry/exit times (Israel's clock), and the reason for the change - required.
function TimeFields({ entry }: { entry?: AttendanceEntry }) {
  const start = entry ? toIsraelParts(entry.clockIn) : null;
  const end = entry?.clockOut ? toIsraelParts(entry.clockOut) : null;
  return (
    <>
      <Field label="תאריך" name="date" type="date" required defaultValue={start?.date ?? toIsraelParts(new Date()).date} />
      <Field label="שעת כניסה" name="clockIn" type="time" required defaultValue={start?.time} />
      <Field label="שעת יציאה" name="clockOut" type="time" required={!entry || !!entry.clockOut} defaultValue={end?.time} />
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="סיבת השינוי (חובה)" name="reason" required placeholder="לדוגמה: שכחתי להחתים יציאה" />
      </div>
    </>
  );
}

function EntryRow({ entry, showName, canEdit }: { entry: AttendanceEntry; showName?: boolean; canEdit: boolean }) {
  const lastEdit = entry.edits[entry.edits.length - 1];
  return (
    <div className="flex items-center justify-between gap-3 p-4 text-sm">
      <div>
        <p className="font-medium text-foreground">
          {showName ? `${entry.userName} · ` : ""}
          {formatIsraelDate(entry.clockIn)}
        </p>
        <p className="text-xs text-muted">
          {formatIsraelTime(entry.clockIn)} - {entry.clockOut ? formatIsraelTime(entry.clockOut) : "כעת"}
          {" · "}
          {formatDuration(entryHours(entry))} שעות
        </p>
        {lastEdit && (
          <p className="mt-0.5 text-xs text-warning" title={entry.edits.map((e) => `${e.byName}: ${e.reason}`).join("\n")}>
            ✎ שונה ידנית{entry.edits.length > 1 ? ` (${entry.edits.length} פעמים)` : ""}: {lastEdit.reason}
            {showName ? ` · ${lastEdit.byName}` : ""}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <EditRecord
            title="שינוי ידני של שעות"
            note="השינוי נשמר עם הסיבה שתכתוב, ויופיע ליד הרשומה."
            action={editAttendanceEntry.bind(null, entry.id)}
          >
            <TimeFields entry={entry} />
          </EditRecord>
          <DeleteButton action={removeAttendanceEntry.bind(null, entry.id)} confirmText="למחוק את הרשומה?" />
        </div>
      )}
    </div>
  );
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; person?: string }>;
}) {
  const ownerId = await requireOwnerId();
  const [userId, role, params, docs, members] = await Promise.all([
    currentUserId(),
    currentRole(),
    searchParams,
    attendanceRepo.list(ownerId, { clockIn: -1 }),
    listOrganizationMembers(ownerId),
  ]);
  const isPartner = role === "partner";
  const all = docs.map(toAttendance);
  // An employee's page only ever holds their own hours.
  const entries = isPartner ? all : all.filter((e) => e.userId === userId);

  const myEntries = entries.filter((e) => e.userId === userId);
  const openEntry = myEntries.find((e) => !e.clockOut) ?? null;

  // The month shown (Israel's calendar), and, for a partner, one person or the whole team.
  const month = isMonth(params.month) ? params.month : currentMonth();
  const people = peopleOf(members, all);
  const person = isPartner && people.some((p) => p.id === params.person) ? params.person! : "";
  const months = [...new Set([currentMonth(), month, ...entries.map(entryMonth)])]
    .sort()
    .reverse()
    .map((value) => ({ value, label: monthLabel(value) }));

  const inMonth = entries.filter((e) => entryMonth(e) === month);
  const myMonth = inMonth.filter((e) => e.userId === userId);
  const [myTotal] = totalsByPerson(myMonth, [{ id: userId, name: "" }]);
  const teamMonth = person ? inMonth.filter((e) => e.userId === person) : inMonth;
  const teamTotals = totalsByPerson(teamMonth, person ? people.filter((p) => p.id === person) : people);
  const personName = people.find((p) => p.id === person)?.name;

  return (
    <div>
      <PageHeader title="שעון נוכחות" subtitle="מעקב שעות עבודה" />

      <Card className="p-5">
        {openEntry ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                בעבודה
              </span>
              <p className="mt-2 text-sm text-muted">
                נכנסת ב-{formatIsraelTime(openEntry.clockIn)} ({formatIsraelDate(openEntry.clockIn)})
              </p>
            </div>
            <form action={clockOut}>
              <button
                type="submit"
                className="rounded-xl bg-danger px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                יציאה
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              לא בעבודה
            </span>
            <form action={clockIn}>
              <button
                type="submit"
                className="rounded-xl bg-brand-blue px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                כניסה
              </button>
            </form>
          </div>
        )}
      </Card>

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">דוח שעות</h2>
        <AttendanceFilters
          month={month}
          months={months}
          person={person}
          people={isPartner ? people : undefined}
        />
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          הרשומות שלי - {monthLabel(month)}
          {myTotal && (
            <span className="ms-2 text-sm font-semibold text-brand-blue">
              {formatDuration(myTotal.hours)} שעות · {myTotal.days} ימים
            </span>
          )}
        </h2>
        <EditRecord
          label="+ הוספת יום ידנית"
          title="הוספת יום עבודה ידנית"
          note="למשל כששכחת להחתים כניסה. הרשומה תסומן כשינוי ידני, עם הסיבה."
          action={addAttendanceEntry}
        >
          <TimeFields />
        </EditRecord>
      </div>
      {myMonth.length === 0 ? (
        <EmptyState
          title={myEntries.length === 0 ? "אין עדיין רשומות נוכחות" : "אין רשומות בחודש הזה"}
          hint={myEntries.length === 0 ? "לחץ על כניסה כדי להתחיל לתעד שעות עבודה." : "אפשר לבחור חודש אחר למעלה."}
        />
      ) : (
        <Card className="divide-y divide-border">
          {myMonth.map((e) => (
            <EntryRow key={e.id} entry={e} canEdit />
          ))}
        </Card>
      )}

      {isPartner && (
        <>
          <h2 className="mb-3 mt-8 text-base font-bold">
            {personName ? `${personName} - ${monthLabel(month)}` : `כל הצוות - ${monthLabel(month)}`}
          </h2>
          {teamTotals.length === 0 ? (
            <p className="text-sm text-muted">אין רשומות נוכחות בחודש הזה.</p>
          ) : (
            <Card className="mb-6 divide-y divide-border">
              {teamTotals.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  {person ? (
                    <span className="font-medium text-foreground">{t.name}</span>
                  ) : (
                    <Link
                      href={`?month=${month}&person=${t.id}`}
                      className="font-medium text-brand-blue hover:underline"
                      title="הצג רק את השעות שלו"
                    >
                      {t.name}
                    </Link>
                  )}
                  <span className="text-muted">
                    {t.days} ימים{t.open ? " · כעת בעבודה" : ""}
                    {" · "}
                    <b className="text-brand-blue">{formatDuration(t.hours)} שעות</b>
                  </span>
                </div>
              ))}
            </Card>
          )}

          {teamMonth.length > 0 && (
            <>
              <h3 className="mb-3 text-sm font-bold text-muted">{personName ? "הרשומות" : "כל הרשומות"}</h3>
              <Card className="divide-y divide-border">
                {teamMonth.map((e) => (
                  <EntryRow key={e.id} entry={e} showName={!person} canEdit />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
