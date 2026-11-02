// Dates and meeting times are stored as the office's wall clock in UTC fields (see the calendar notes),
// so they are formatted in UTC to show exactly what was typed.
const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

// The attendance clock records real moments (when the button was pressed), shown in Israel's time.
const ISRAEL = "Asia/Jerusalem";
const israelDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: ISRAEL });
const israelTime = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: ISRAEL });
const israelParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ISRAEL,
});

export const formatIsraelDate = (iso: string) => israelDate.format(new Date(iso));
export const formatIsraelTime = (iso: string) => israelTime.format(new Date(iso));

/** A moment as Israel's calendar day and clock time: { date: "2026-11-02", time: "08:30" }. */
export function toIsraelParts(value: Date | string) {
  const parts = Object.fromEntries(israelParts.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The moment a day and clock time in Israel stand for (summer and winter time included). */
export function fromIsraelParts(date: string, time: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const asUtc = Date.UTC(+match[1], +match[2] - 1, +match[3], +clock[1], +clock[2]);
  // Israel's offset at that moment, found by reading the guess back in Israel's time (twice, for the
  // hours around a clock change).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = toIsraelParts(new Date(guess));
    const shownUtc = Date.parse(`${shown.date}T${shown.time}:00Z`);
    guess = asUtc - (shownUtc - guess);
  }
  return new Date(guess);
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return dateFormatter.format(new Date(iso));
}

export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}

export function formatMoney(amount: number) {
  return `₪${amount.toLocaleString("he-IL")}`;
}

/** Formats גוש/חלקה/תת חלקה compactly, skipping whichever parts are blank. */
export function formatParcel(block: string, parcel: string, subParcel: string) {
  const parts = [
    block && `גוש ${block}`,
    parcel && `חלקה ${parcel}`,
    subParcel && `תת חלקה ${subParcel}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Every property of a quote or case - the main one and any added - as one line each,
 * e.g. "גוש 5209 · חלקה 35 - הרצל 8, בית שמש".
 */
export function propertyLines(
  item: { block: string; parcel: string; subParcel: string; address: string; city: string } & {
    extraProperties?: { block: string; parcel: string; subParcel: string; address: string; city: string }[];
  },
) {
  return [item, ...(item.extraProperties ?? [])]
    .map((p) =>
      [formatParcel(p.block, p.parcel, p.subParcel), [p.address, p.city].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean);
}

/** Formats decimal hours as "H:MM", e.g. 2.25 -> "2:15". */
export function formatDuration(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function isSameDay(iso: string, reference: Date) {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/** Whole days from today until `iso`; negative once the date has passed. */
export function daysUntil(iso: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const startOfTarget = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startOfTarget - startOfToday) / 86_400_000);
}
