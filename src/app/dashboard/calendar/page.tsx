import { headers } from "next/headers";
import Link from "next/link";
import {
  createEvent,
  deleteEvent,
  disconnectCalendarSync,
  disconnectOneDrive,
  rotateCalendarFeed,
} from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import {
  addDays,
  buildCalendarItems,
  dayNames,
  todayInIsraelDay,
  weekStartOf,
} from "@/lib/calendar";
import { syncCalendar } from "@/lib/calendar-sync";
import { getCalendarConnection } from "@/lib/db/calendar-connection";
import { getFeedToken } from "@/lib/db/calendar-feed";
import { getCalendarAuthorizeUrl } from "@/lib/ms-calendar";
import { loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
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
  searchParams: Promise<{
    onedrive?: string;
    onedrive_error?: string;
    calendar?: string;
    calendar_error?: string;
    week?: string;
  }>;
}) {
  const ownerId = await requireOwnerId();
  // Bring in what was added in the Outlook/Apple calendar before reading the events
  // (a no-op when it isn't linked, or was synced in the last minute).
  const sync = await syncCalendar(ownerId).catch(() => null);
  const calendarLink = await getCalendarConnection(ownerId);

  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { events, cases } = result.data;

  // Meetings/hearings are stored; case deadlines are derived from the cases, so
  // the calendar can never drift out of sync with them.
  const items = buildCalendarItems(events, cases);

  const params = await searchParams;

  // The working week, Sunday to Thursday.
  const weekStart = weekStartOf(params.week);
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekend = [addDays(weekStart, 5), addDays(weekStart, 6)];
  const today = todayInIsraelDay();
  const weekItems = (day: string) => items.filter((i) => i.day === day);
  const weekendItems = items.filter((i) => weekend.includes(i.day));

  const feedToken = await getFeedToken(ownerId);
  const origin = await getOrigin();
  const feedPath = feedToken ? `/api/calendar/${feedToken}.ics` : null;
  const connected = isOneDriveConfigured() && (await isConnected(ownerId));
  const authorizeUrl = isOneDriveConfigured() ? getAuthorizeUrl(ownerId, origin) : null;
  const calendarAuthorizeUrl = isOneDriveConfigured()
    ? getCalendarAuthorizeUrl(ownerId, origin)
    : null;
  const syncError = sync && !sync.ok ? sync.error : (calendarLink?.lastError ?? null);

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
        action={form}
      />

      {params.onedrive === "connected" && (
        <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          OneDrive חובר בהצלחה
        </div>
      )}
      {params.calendar === "connected" && (
        <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          יומן Outlook חובר בהצלחה
        </div>
      )}
      {params.calendar === "error" && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          חיבור יומן Outlook נכשל{params.calendar_error ? `: ${params.calendar_error}` : ""}
        </div>
      )}
      {params.onedrive === "error" && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          חיבור OneDrive נכשל{params.onedrive_error ? `: ${params.onedrive_error}` : ""}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            {formatDate(days[0])} – {formatDate(days[4])}
          </h2>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Link
              href={`/dashboard/calendar?week=${addDays(weekStart, -7)}`}
              className="rounded-lg border border-border px-3 py-1.5 hover:bg-background"
            >
              → שבוע קודם
            </Link>
            <Link
              href="/dashboard/calendar"
              className="rounded-lg border border-border px-3 py-1.5 hover:bg-background"
            >
              היום
            </Link>
            <Link
              href={`/dashboard/calendar?week=${addDays(weekStart, 7)}`}
              className="rounded-lg border border-border px-3 py-1.5 hover:bg-background"
            >
              שבוע הבא ←
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {days.map((day, i) => (
            <DayColumn
              key={day}
              label={`יום ${dayNames[i]}`}
              day={day}
              isToday={day === today}
              items={weekItems(day)}
            />
          ))}
        </div>

        {weekendItems.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted">בסוף השבוע (שישי-שבת)</p>
            <div className="space-y-2">
              {weekendItems.map((item) => (
                <EventCard key={item.id} item={item} showDay />
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold">סנכרון עם יומן Apple (דרך Outlook)</h2>
          <p className="mt-3 text-sm text-muted">
            המערכת מסתנכרנת עם יומן בשם TA-Estate בחשבון Outlook של המשרד (y@ta-estate.co.il).
            את אותו חשבון מוסיפים ליומן של Apple, ומשם הכול זז בשני הכיוונים: דדליין או דיון
            שנוספו במערכת מופיעים ב-Apple, ואירוע שתוסיף ב-Apple ביומן TA-Estate מופיע
            במערכת.
          </p>

          {calendarLink ? (
            <>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                מחובר
              </span>
              {syncError && (
                <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                  הסנכרון האחרון נכשל: {syncError}
                </p>
              )}
              <ol className="mt-3 list-decimal space-y-1 pr-5 text-xs text-muted">
                <li>
                  במק: הגדרות מערכת ← חשבונות אינטרנט ← הוסף חשבון ← Microsoft Exchange, עם
                  y@ta-estate.co.il. באייפון: הגדרות ← יומן ← חשבונות ← הוסף חשבון ←
                  Microsoft Exchange.
                </li>
                <li>הפעל &quot;יומנים&quot; בחשבון. ביומן של Apple יופיע יומן בשם TA-Estate.</li>
                <li>אירועים חדשים מוסיפים אל יומן TA-Estate.</li>
              </ol>
              <p className="mt-3 text-xs text-muted">
                אירוע שנוסף במערכת מופיע ב-Apple תוך דקות. אירוע שנוסף ב-Apple מופיע כאן כשמישהו
                פותח את היומן במערכת (עד דקה).
              </p>
              <form action={disconnectCalendarSync} className="mt-3">
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background"
                >
                  נתק את יומן Outlook
                </button>
              </form>
            </>
          ) : calendarAuthorizeUrl ? (
            <>
              <a
                href={calendarAuthorizeUrl}
                className="mt-3 inline-block rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                חבר יומן Outlook
              </a>
              <p className="mt-2 text-xs text-muted">
                תתבקש להיכנס עם y@ta-estate.co.il ולאשר גישה ליומן. אם מופיעה הודעה שנדרש
                אישור מנהל, מנהל החשבון של המשרד צריך לאשר את האפליקציה.
              </p>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-muted">
              תצורת Microsoft חסרה בצד השרת
            </p>
          )}

          <details className="mt-5 border-t border-border pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-muted">
              אפשרות פשוטה יותר: צפייה בלבד ב-Apple (חד-כיווני)
            </summary>
            <p className="mt-3 text-xs text-muted">
              מציגה ב-Apple את האירועים והדדליינים בלי חיבור ל-Microsoft, אבל אירוע שנוסף
              ב-Apple לא יופיע במערכת. אל תשתמש בשתי האפשרויות יחד, כדי שהאירועים לא יוצגו
              פעמיים.
            </p>
            {feedPath ? (
              <>
                <a
                  href={`webcal://${origin.replace(/^https?:\/\//, "")}${feedPath}`}
                  className="mt-3 inline-block rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background"
                >
                  הוסף ליומן Apple
                </a>
                <p dir="ltr" className="mt-2 break-all rounded-lg bg-background px-3 py-2 text-left text-[11px] text-muted">
                  {origin}
                  {feedPath}
                </p>
                <p className="mt-2 text-xs text-warning">
                  הקישור הוא הסיסמה ליומן: מי שיש לו אותו רואה את הנתונים. אפשר להחליף אותו
                  והישן יפסיק לעבוד.
                </p>
                <form action={rotateCalendarFeed} className="mt-2">
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background"
                  >
                    החלף קישור
                  </button>
                </form>
              </>
            ) : (
              <form action={rotateCalendarFeed} className="mt-3">
                <button
                  type="submit"
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background"
                >
                  צור קישור לסנכרון
                </button>
              </form>
            )}
          </details>
        </Card>
      </div>
    </div>
  );
}

type Item = ReturnType<typeof buildCalendarItems>[number];

function DayColumn({
  label,
  day,
  isToday,
  items,
}: {
  label: string;
  day: string;
  isToday: boolean;
  items: Item[];
}) {
  return (
    <div className={`rounded-xl border p-2.5 ${isToday ? "border-brand-cyan bg-brand-cyan-light/30" : "border-border"}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-sm font-bold ${isToday ? "text-brand-blue" : "text-foreground"}`}>{label}</span>
        <span className="text-xs text-muted">{formatDate(day)}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted/70">—</p>
        ) : (
          items.map((item) => <EventCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function EventCard({ item, showDay }: { item: Item; showDay?: boolean }) {
  const deadline = item.time === null;
  return (
    <div
      className={`rounded-lg p-2 text-xs ${deadline ? "bg-warning/10" : "bg-brand-cyan-light"}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`font-bold ${deadline ? "text-warning" : "text-brand-blue"}`}>
          {showDay && `${formatDate(item.day)} · `}
          {deadline ? "דדליין" : item.time}
        </span>
        {item.eventId && (
          <DeleteButton
            action={deleteEvent.bind(null, item.eventId)}
            confirmText="למחוק את הפגישה?"
          />
        )}
      </div>
      <p className="mt-0.5 font-semibold text-foreground">{item.title}</p>
      {item.detail && <p className="mt-0.5 text-muted">{item.detail}</p>}
    </div>
  );
}
