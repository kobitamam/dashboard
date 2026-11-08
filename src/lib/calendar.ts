import { caseDeadlines } from "@/lib/deadlines";
import { isWorkDone, type CalendarEvent, type Case, type EventVisibility } from "@/lib/types";

/** Whether someone sees an event, by its sharing choice: everyone, the partners only, or its creator alone. */
export function canSeeEvent(
  event: { createdBy: string | null; visibility: EventVisibility },
  viewer: { id: string; role: "partner" | "employee" },
) {
  if (event.visibility === "partners") return viewer.role === "partner" || event.createdBy === viewer.id;
  if (event.visibility === "private") return event.createdBy === viewer.id;
  return true;
}

// An event's colour follows who added it (the founding partner yellow, the other partners pink).
export type EventColor = "yellow" | "pink";

// Event times are entered and shown as plain office-clock times and stored as
// their UTC fields, so the calendar page and the .ics feed read them the same way
// ("floating" times: 10:00 stays 10:00 on whatever device subscribes).
export type CalendarItem = {
  id: string;
  day: string; // YYYY-MM-DD
  time: string | null; // HH:MM, null for an all-day deadline
  endTime: string | null;
  title: string;
  detail: string;
  kind: string; // the event type, or "דדליין", for colouring
  eventId?: string;
  color?: EventColor; // by who added it; otherwise the kind's colour
  visibility?: EventVisibility;
};

export function buildCalendarItems(
  events: CalendarEvent[],
  cases: Case[],
  colorOf: (createdBy: string | null) => EventColor | undefined = () => undefined,
): CalendarItem[] {
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const items: CalendarItem[] = [
    ...events.map((e) => {
      const linked = e.caseId ? caseById.get(e.caseId) : undefined;
      return {
        id: `event-${e.id}`,
        day: e.start.slice(0, 10),
        time: e.allDay ? null : e.start.slice(11, 16),
        endTime: e.allDay ? null : addMinutes(e.start, 60).slice(11, 16),
        title: e.title,
        kind: e.type,
        detail: [e.type, linked ? `תיק ${linked.caseNumber} · ${linked.clientName}` : "", e.location]
          .filter(Boolean)
          .join(" · "),
        eventId: e.id,
        color: colorOf(e.createdBy),
        visibility: e.visibility,
      };
    }),
    ...cases
      .filter((c) => !isWorkDone(c.status))
      .flatMap((c) =>
        caseDeadlines(c).map((d) => ({
          id: `deadline-${c.id}-${d.key}`,
          day: d.date,
          time: null,
          endTime: null,
          title: `דדליין: ${d.label}`,
          kind: "דדליין",
          detail: `תיק ${c.caseNumber} · ${c.clientName}`,
        })),
      ),
  ];
  return items.sort((a, b) =>
    `${a.day} ${a.time ?? ""}`.localeCompare(`${b.day} ${b.time ?? ""}`),
  );
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// ---- weeks (Sunday to Thursday are the working days) ----

export function todayInIsraelDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/** Minutes since midnight on the office clock (Israel). */
export function israelNowMinutes() {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Sunday of the week containing `day` (today if missing or malformed). */
export function weekStartOf(day?: string) {
  const valid = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day));
  const base = valid ? day : todayInIsraelDay();
  const weekday = new Date(`${base}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(base, -weekday);
}

export const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// ---- iCalendar feed (read by Apple Calendar and others) ----

function escapeText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Content lines are folded at 75 octets; continuation lines start with a space.
function fold(line: string) {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 74) {
      out.push(current);
      current = " ";
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

const compactDay = (day: string) => day.replace(/-/g, "");
const compactDateTime = (day: string, time: string) => `${compactDay(day)}T${time.replace(":", "")}00`;

export function buildIcs(items: CalendarItem[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TA-Estate//Dashboard//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:TA-Estate",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const item of items) {
    lines.push("BEGIN:VEVENT", `UID:${item.id}@ta-estate`, `DTSTAMP:${stamp}`);
    if (item.time) {
      lines.push(
        `DTSTART:${compactDateTime(item.day, item.time)}`,
        // An event is exported as one hour long (the app stores only its start).
        `DTEND:${compactDateTime(item.endTime && item.endTime < item.time ? addDays(item.day, 1) : item.day, item.endTime ?? item.time)}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDay(item.day)}`,
        `DTEND;VALUE=DATE:${compactDay(addDays(item.day, 1))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(item.title)}`);
    if (item.detail) lines.push(`DESCRIPTION:${escapeText(item.detail)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
