// Day arithmetic for the days calculator. Dates are whole calendar days, handled
// as UTC midnights so daylight-saving changes can never shift a result by a day.

export type Exclusions = {
  /** Index 0 = Sunday ... 6 = Saturday. */
  weekdays: boolean[];
  holidays: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const toDay = (date: Date) => date.toISOString().slice(0, 10);

function plus(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

const hebrewParts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

/** Hebrew-calendar month name ("Tishri", "Nisan", ...) and day of month for a civil date. */
function hebrewDate(date: Date) {
  const parts = hebrewParts.formatToParts(date);
  return {
    month: parts.find((p) => p.type === "month")?.value ?? "",
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/**
 * Israel's public holidays that close the offices: Rosh Hashana (2 days), Yom Kippur,
 * the first day of Sukkot, Shemini Atzeret, the first and last day of Pesach, Shavuot
 * and Independence Day. Computed from the Hebrew calendar, so it works for any year.
 */
export function holidayName(date: Date): string | null {
  const { month, day } = hebrewDate(date);
  const weekday = date.getUTCDay();

  if (month === "Tishri") {
    if (day === 1 || day === 2) return "ראש השנה";
    if (day === 10) return "יום כיפור";
    if (day === 15) return "סוכות";
    if (day === 22) return "שמיני עצרת";
  }
  if (month === "Nisan" && (day === 15 || day === 21)) return "פסח";
  if (month === "Sivan" && day === 6) return "שבועות";
  if (month === "Iyar") {
    // 5 Iyar, moved off Friday/Saturday (to the Thursday before) and off Monday (to Tuesday).
    if (day === 5 && weekday !== 5 && weekday !== 6 && weekday !== 1) return "יום העצמאות";
    if (day === 4 && weekday === 4) return "יום העצמאות";
    if (day === 3 && weekday === 4) return "יום העצמאות";
    if (day === 6 && weekday === 2) return "יום העצמאות";
  }
  return null;
}

export function isExcluded(date: Date, exclusions: Exclusions) {
  return exclusions.weekdays[date.getUTCDay()] || (exclusions.holidays && holidayName(date) !== null);
}

/** Years and months by the calendar; a day that doesn't exist in the target month becomes its last day. */
export function addCalendar(start: Date, years: number, months: number) {
  const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + years * 12 + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
}

/**
 * Moves `days` days forward (or back, if negative) counting only the days that are not
 * excluded. Returns the date reached and how many days were skipped on the way.
 */
export function moveDays(start: Date, days: number, exclusions: Exclusions) {
  const step = days < 0 ? -1 : 1;
  let remaining = Math.abs(days);
  let date = start;
  let skipped = 0;
  // Guards against excluding every day of the week, which could never finish.
  let guard = 0;
  while (remaining > 0 && guard++ < 100000) {
    date = plus(date, step);
    if (isExcluded(date, exclusions)) skipped++;
    else remaining--;
  }
  return { date, skipped };
}

/** Days from `start` to `end` that are not excluded (the end counts, the start only if asked). */
export function countDays(start: Date, end: Date, exclusions: Exclusions, includeStart: boolean) {
  const forward = end.getTime() >= start.getTime();
  const from = forward ? start : end;
  const to = forward ? end : start;
  let counted = 0;
  let skipped = 0;
  for (let date = includeStart ? from : plus(from, 1); date.getTime() <= to.getTime(); date = plus(date, 1)) {
    if (isExcluded(date, exclusions)) skipped++;
    else counted++;
  }
  return { counted, skipped, forward };
}

export const weekdayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
