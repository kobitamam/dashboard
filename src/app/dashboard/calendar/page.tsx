import { headers } from "next/headers";
import Link from "next/link";
import { createEvent, disconnectOneDrive, rotateCalendarFeed } from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import WeekCalendar from "@/components/WeekCalendar";
import { isConnected } from "@/lib/db/onedrive-connection";
import {
  addDays,
  buildCalendarItems,
  israelNowMinutes,
  todayInIsraelDay,
  weekStartOf,
} from "@/lib/calendar";
import { getFeedToken } from "@/lib/db/calendar-feed";
import { loadDashboardData, requireOwnerId } from "@/lib/db/queries";
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
    week?: string;
    weekend?: string;
  }>;
}) {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { events, cases } = result.data;

  // Meetings/hearings are stored; case deadlines are derived from the cases, so
  // the calendar can never drift out of sync with them.
  const items = buildCalendarItems(events, cases);

  const params = await searchParams;
  const ownerId = await requireOwnerId();

  // A week starts on Sunday; Friday and Saturday are shown on request.
  const showWeekend = params.weekend === "1";
  const weekStart = weekStartOf(params.week);
  const days = Array.from({ length: showWeekend ? 7 : 5 }, (_, i) => addDays(weekStart, i));
  const hiddenDays = showWeekend ? [] : [addDays(weekStart, 5), addDays(weekStart, 6)];
  const hiddenCount = items.filter((i) => hiddenDays.includes(i.day)).length;
  const today = todayInIsraelDay();
  const nowMinutes = israelNowMinutes();
  const weekHref = (week?: string, weekend = showWeekend) => {
    const query = new URLSearchParams();
    if (week) query.set("week", week);
    if (weekend) query.set("weekend", "1");
    const text = query.toString();
    return `/dashboard/calendar${text ? `?${text}` : ""}`;
  };
  const monthLabel = new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${addDays(weekStart, 2)}T00:00:00Z`));

  const feedToken = await getFeedToken(ownerId);
  const origin = await getOrigin();
  const feedPath = feedToken ? `/api/calendar/${feedToken}.ics` : null;
  const connected = isOneDriveConfigured() && (await isConnected(ownerId));
  const authorizeUrl = isOneDriveConfigured() ? getAuthorizeUrl(ownerId, origin) : null;

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

  const navButton =
    "rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-background";

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
      {params.onedrive === "error" && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          חיבור OneDrive נכשל{params.onedrive_error ? `: ${params.onedrive_error}` : ""}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <h2 className="text-2xl font-bold">{monthLabel}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={weekHref(addDays(weekStart, -7))} className={navButton} aria-label="שבוע קודם">
              →
            </Link>
            <Link href={weekHref()} className={navButton}>
              היום
            </Link>
            <Link href={weekHref(addDays(weekStart, 7))} className={navButton} aria-label="שבוע הבא">
              ←
            </Link>
            <Link href={weekHref(params.week, !showWeekend)} className={`${navButton} text-muted`}>
              {showWeekend ? "הסתר שישי-שבת" : "הצג שישי-שבת"}
            </Link>
          </div>
        </div>

        {hiddenCount > 0 && (
          <p className="border-t border-border bg-warning/10 px-4 py-2 text-xs text-warning">
            יש {hiddenCount} אירועים בשישי-שבת של השבוע הזה.{" "}
            <Link href={weekHref(params.week, true)} className="font-semibold underline">
              הצג
            </Link>
          </p>
        )}

        <WeekCalendar days={days} today={today} nowMinutes={nowMinutes} items={items} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold">הצגה ביומן של Apple</h2>
          <p className="mt-3 text-sm text-muted">
            מוסיף ליומן של Apple יומן נוסף ברשימה שבצד, כמו היומנים האחרים שלך. אפשר לתת לו
            שם וצבע משלו. הוא מציג את הפגישות, הדיונים והדדליינים של התיקים ומתעדכן לבד.
            הוא לצפייה בלבד: אירוע שמוסיפים ב-Apple לא נכנס למערכת.
          </p>
          {feedPath ? (
            <>
              <a
                href={`webcal://${origin.replace(/^https?:\/\//, "")}${feedPath}`}
                className="mt-3 inline-block rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                הוסף ליומן Apple
              </a>
              <ol className="mt-3 list-decimal space-y-1 pr-5 text-xs text-muted">
                <li>במק: לחץ על הכפתור, או ביומן: קובץ ← מנוי חדש ליומן, והדבק את הכתובת שמתחת.</li>
                <li>בחר שם וצבע, ובשדה &quot;רענון אוטומטי&quot; בחר &quot;כל 5 דקות&quot;.</li>
                <li>באייפון: הגדרות ← יומן ← חשבונות ← הוסף חשבון ← אחר ← הוסף יומן מנוי.</li>
              </ol>
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
                className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                צור קישור לסנכרון
              </button>
            </form>
          )}
        </Card>

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
