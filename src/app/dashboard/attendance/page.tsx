import { clockIn, clockOut, removeAttendanceEntry } from "@/app/dashboard/attendance-actions";
import { DeleteButton, EmptyState } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { attendanceRepo, toAttendance } from "@/lib/db/entities";
import { currentRole, currentUserId, requireOwnerId } from "@/lib/db/queries";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { AttendanceEntry } from "@/lib/types";

function hoursBetween(startIso: string, endIso: string | null) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return (end - start) / 3_600_000;
}

function EntryRow({ entry, showName }: { entry: AttendanceEntry; showName?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 text-sm">
      <div>
        <p className="font-medium text-foreground">
          {showName ? `${entry.userName} · ` : ""}
          {formatDate(entry.clockIn)}
        </p>
        <p className="text-xs text-muted">
          {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "כעת"}
          {" · "}
          {formatDuration(hoursBetween(entry.clockIn, entry.clockOut))} שעות
        </p>
      </div>
      <DeleteButton action={removeAttendanceEntry.bind(null, entry.id)} confirmText="למחוק את הרשומה?" />
    </div>
  );
}

export default async function AttendancePage() {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();
  const isPartner = (await currentRole()) === "partner";

  const docs = await attendanceRepo.list(ownerId, { clockIn: -1 });
  const entries = docs.map(toAttendance);

  const myEntries = entries.filter((e) => e.userId === userId);
  const openEntry = myEntries.find((e) => !e.clockOut) ?? null;

  const now = new Date();
  const monthlyTotals = new Map<string, { name: string; hours: number }>();
  for (const e of entries) {
    const d = new Date(e.clockIn);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    const hours = hoursBetween(e.clockIn, e.clockOut);
    const existing = monthlyTotals.get(e.userId);
    if (existing) existing.hours += hours;
    else monthlyTotals.set(e.userId, { name: e.userName, hours });
  }

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
                נכנסת ב-{formatTime(openEntry.clockIn)} ({formatDate(openEntry.clockIn)})
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

      <h2 className="mb-3 mt-6 text-lg font-bold">הרשומות שלי</h2>
      {myEntries.length === 0 ? (
        <EmptyState
          title="אין עדיין רשומות נוכחות"
          hint="לחץ על כניסה כדי להתחיל לתעד שעות עבודה."
        />
      ) : (
        <Card className="divide-y divide-border">
          {myEntries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </Card>
      )}

      {isPartner && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">כל הצוות - החודש</h2>
          {monthlyTotals.size === 0 ? (
            <p className="text-sm text-muted">אין עדיין רשומות נוכחות החודש.</p>
          ) : (
            <Card className="mb-6 divide-y divide-border">
              {[...monthlyTotals.values()].map((u) => (
                <div key={u.name} className="flex items-center justify-between p-4 text-sm">
                  <span className="font-medium text-foreground">{u.name}</span>
                  <span className="font-semibold text-brand-blue">
                    {formatDuration(u.hours)} שעות
                  </span>
                </div>
              ))}
            </Card>
          )}

          <h2 className="mb-3 text-lg font-bold">כל הרשומות</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">אין רשומות.</p>
          ) : (
            <Card className="divide-y divide-border">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} showName />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
