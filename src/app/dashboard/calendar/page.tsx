import { headers } from "next/headers";
import { createEvent, deleteEvent, disconnectOneDrive } from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import { caseDeadlines } from "@/lib/deadlines";
import { loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { daysUntil, formatDate, formatTime } from "@/lib/format";
import { getAuthorizeUrl, isOneDriveConfigured } from "@/lib/onedrive";
import { eventTypes } from "@/lib/types";

async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ onedrive?: string; onedrive_error?: string }>;
}) {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { events, cases } = result.data;
  const caseById = new Map(cases.map((c) => [c.id, c]));

  // Meetings/hearings are stored; case deadlines are derived from the cases, so
  // the calendar can never drift out of sync with them.
  type Item = {
    id: string;
    start: string;
    allDay: boolean;
    title: string;
    detail: string;
    eventId?: string;
  };
  const items: Item[] = [
    ...events.map((e) => {
      const linked = e.caseId ? caseById.get(e.caseId) : undefined;
      return {
        id: `event-${e.id}`,
        start: e.start,
        allDay: false,
        title: e.title,
        detail: [e.type, linked ? `תיק ${linked.caseNumber} · ${linked.clientName}` : "", e.location]
          .filter(Boolean)
          .join(" · "),
        eventId: e.id,
      };
    }),
    ...cases
      .filter((c) => c.status !== "הושלם")
      .flatMap((c) =>
        caseDeadlines(c).map((d) => ({
          id: `deadline-${c.id}-${d.key}`,
          start: d.date,
          allDay: true,
          title: `דדליין: ${d.label}`,
          detail: `תיק ${c.caseNumber} · ${c.clientName}`,
        })),
      ),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const upcoming = items.filter((i) => (daysUntil(i.start) ?? 0) >= 0);

  const params = await searchParams;
  const ownerId = await requireOwnerId();
  const connected = isOneDriveConfigured() && (await isConnected(ownerId));
  const authorizeUrl = isOneDriveConfigured()
    ? getAuthorizeUrl(ownerId, await getOrigin())
    : null;

  const form = (
    <AddRecord label="+ פגישה חדשה" action={createEvent}>
      <Field label="נושא" name="title" required placeholder="ביקור בנכס - רחוב, עיר" />
      <Field label="מועד" name="start" type="datetime-local" required />
      <Field label="מיקום" name="location" placeholder="עיר / מקוון / טלפוני" />
      <SelectField label="סוג" name="type" options={eventTypes} defaultValue="פגישת לקוח" />
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">תיק קשור (אופציונלי)</span>
        <select
          name="caseId"
          defaultValue=""
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan"
        >
          <option value="">ללא תיק</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseNumber} · {c.clientName}
            </option>
          ))}
        </select>
      </label>
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="יומן ופגישות"
        subtitle="הפגישות, הדיונים, הביקורים בנכסים ודדליינים של התיקים"
        action={items.length > 0 ? form : undefined}
      />

      {params.onedrive === "connected" && (
        <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          OneDrive חובר בהצלחה
        </div>
      )}
      {params.onedrive === "error" && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          חיבור OneDrive נכשל{params.onedrive_error ? `: ${params.onedrive_error}` : ""}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState
              title="היומן ריק"
              hint="הוסף פגישה או ביקור בנכס. פגישות שמתקיימות היום יופיעו אוטומטית בדשבורד ובהתראות."
              action={form}
            />
          ) : (
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-bold">
                אירועים קרובים
                <span className="mr-2 text-sm font-normal text-muted">
                  ({upcoming.length})
                </span>
              </h2>
              <div className="space-y-3">
                {items.map((e) => {
                  const days = daysUntil(e.start);
                  const past = days !== null && days < 0;
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 rounded-xl border border-border p-3 ${past ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg ${e.allDay ? "bg-warning/10 text-warning" : "bg-brand-cyan-light text-brand-blue"}`}
                      >
                        <span className="text-sm font-bold">
                          {e.allDay ? "דדליין" : formatTime(e.start)}
                        </span>
                        <span className="text-[11px]">{formatDate(e.start)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                        <p className="text-xs text-muted">
                          {e.detail}
                          {days === 0 ? " · היום" : ""}
                        </p>
                      </div>
                      {e.eventId && (
                        <DeleteButton
                          action={deleteEvent.bind(null, e.eventId)}
                          confirmText="למחוק את הפגישה?"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold">OneDrive</h2>

          {connected ? (
            <>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                מחובר
              </span>
              <p className="mt-3 text-sm text-muted">
                התיקיות שהמערכת יוצרת לתיקים שלך נשמרות בתיקיה הייעודית של האפליקציה
                ב-OneDrive שלך.
              </p>
              <form action={disconnectOneDrive} className="mt-3">
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background"
                >
                  נתק את OneDrive
                </button>
              </form>
            </>
          ) : (
            <>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                לא מחובר
              </span>
              <p className="mt-3 text-sm text-muted">
                חיבור ל-OneDrive שלך מאפשר למערכת ליצור תיקיה לכל תיק, בתוך תיקיה ייעודית
                באחסון שלך - לגישה רק לתיקיה הזו, לא לשאר הקבצים שלך.
              </p>
              {authorizeUrl ? (
                <a
                  href={authorizeUrl}
                  className="mt-3 inline-block rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  התחבר ל-OneDrive
                </a>
              ) : (
                <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-muted">
                  תצורת OneDrive חסרה בצד השרת (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
